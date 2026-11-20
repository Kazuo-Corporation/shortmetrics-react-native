import { Storage } from './storage';
import type { QueuedEvent } from './types';

const MAX_QUEUE = 1000;
const BATCH_SIZE = 50;
const FLUSH_DELAY_MS = 2000;
const FLUSH_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 15000;
const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export interface QueueOptions {
  /** Where to send; null while the SDK is not configured (events stay queued) */
  getTarget: () => { endpoint: string; apiKey: string } | null;
  /** Fills fields that were not known at track time (installId, device signals) */
  prepare: (events: QueuedEvent[]) => Promise<QueuedEvent[]>;
}

/**
 * Persisted event queue. Events survive restarts in AsyncStorage and are sent
 * in batches of up to 50; failed sends are retried with exponential backoff.
 */
export class EventQueue {
  private events: QueuedEvent[] = [];
  private loading: Promise<void> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private backoffMs = 0;
  private retryAt = 0;
  private stopped = false;

  constructor(private options: QueueOptions) {}

  get size(): number {
    return this.events.length;
  }

  /** Loads events saved by a previous run (once) */
  load(): Promise<void> {
    if (!this.loading) {
      this.loading = Storage.getQueue().then((saved) => {
        const valid = saved.filter((event) => typeof event?.eventType === 'string');
        this.events = this.trim([...valid, ...this.events]);
      });
    }
    return this.loading;
  }

  async enqueue(event: QueuedEvent): Promise<void> {
    await this.load();
    this.events = this.trim([...this.events, event]);
    await this.persist();
    this.schedule(FLUSH_DELAY_MS);
  }

  /** Starts the 30s flush interval */
  start(): void {
    if (this.interval) return;
    this.stopped = false;
    this.interval = setInterval(() => {
      if (this.events.length) void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Stops all timers */
  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    this.timer = null;
    this.interval = null;
  }

  /** Sends queued events; only one flush runs at a time. Never rejects. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.drain()
        .catch((error) => console.warn('ShortMetrics flush error:', error))
        .finally(() => {
          this.flushing = null;
        });
    }
    return this.flushing;
  }

  private async drain(): Promise<void> {
    await this.load();
    while (this.events.length && !this.stopped) {
      const target = this.options.getTarget();
      if (!target) return;
      if (Date.now() < this.retryAt) {
        this.schedule(this.retryAt - Date.now());
        return;
      }

      const batch = this.events.slice(0, BATCH_SIZE);
      const result = await this.send(target, await this.options.prepare(batch));
      if (result.retry) {
        this.backoffMs = Math.min(this.backoffMs ? this.backoffMs * 2 : MIN_BACKOFF_MS, MAX_BACKOFF_MS);
        const delay = Math.min(Math.max(this.backoffMs, result.retryAfterMs ?? 0), MAX_BACKOFF_MS);
        this.retryAt = Date.now() + delay;
        this.schedule(delay);
        return;
      }

      // Sent or rejected: remove the batch (the cap may have dropped some of it meanwhile)
      this.backoffMs = 0;
      this.retryAt = 0;
      const sent = new Set(batch);
      this.events = this.events.filter((event) => !sent.has(event));
      await this.persist();
    }
  }

  private async send(
    target: { endpoint: string; apiKey: string },
    events: QueuedEvent[]
  ): Promise<{ retry: boolean; retryAfterMs?: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': target.apiKey,
        },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      });
      if (response.ok) return { retry: false };
      if (response.status === 429 || response.status >= 500) {
        return { retry: true, retryAfterMs: parseRetryAfter(response.headers?.get?.('Retry-After')) };
      }
      console.warn(`ShortMetrics dropped ${events.length} events: ${response.status}`);
      return { retry: false };
    } catch (error) {
      // Network error or timeout
      return { retry: true };
    } finally {
      clearTimeout(timeout);
    }
  }

  private schedule(delay: number): void {
    if (this.timer || this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private trim(events: QueuedEvent[]): QueuedEvent[] {
    return events.length > MAX_QUEUE ? events.slice(events.length - MAX_QUEUE) : events;
  }

  // Writes run one after another so an older snapshot never overwrites a newer one
  private persist(): Promise<void> {
    this.writing = this.writing.then(() => Storage.setQueue(this.events));
    return this.writing;
  }
}

function parseRetryAfter(value?: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
