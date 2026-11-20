import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventQueue } from '../src/queue';
import type { QueuedEvent } from '../src/types';

const QUEUE_KEY = '@shortmetrics_queue';
const target = { endpoint: 'https://api.shortmetrics.ai/events', apiKey: 'evt2_test' };

const event = (i: number): QueuedEvent => ({
  eventId: `event-${i}`,
  occurredAt: '2026-11-20T00:00:00.000Z',
  eventType: 'custom_test',
  sessionId: 'session-1',
  properties: { i },
});

const response = (status: number, retryAfter?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name === 'Retry-After' ? retryAfter ?? null : null) },
});

const makeQueue = (getTarget: () => typeof target | null = () => target) =>
  new EventQueue({ getTarget, prepare: async (events) => events });

const fetchMock = () => global.fetch as jest.Mock;
const sentBatches = () =>
  fetchMock().mock.calls.map((call) => JSON.parse(call[1].body).events as QueuedEvent[]);
const stored = async () => JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');

describe('EventQueue', () => {
  let queue: EventQueue;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(response(200));
  });

  afterEach(() => {
    queue?.stop();
    jest.useRealTimers();
  });

  it('survives a restart by reloading saved events', async () => {
    queue = makeQueue(() => null);
    await queue.enqueue(event(1));
    await queue.enqueue(event(2));
    queue.stop();

    queue = makeQueue();
    await queue.load();
    expect(queue.size).toBe(2);

    await queue.flush();
    expect(sentBatches()).toEqual([[event(1), event(2)]]);
    expect(await stored()).toEqual([]);
  });

  it('sends POST { events } with the API key header', async () => {
    queue = makeQueue();
    await queue.enqueue(event(1));
    await queue.flush();

    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe(target.endpoint);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-Key': 'evt2_test' });
    expect(JSON.parse(init.body)).toEqual({ events: [event(1)] });
  });

  it('flushes about 2s after an event is enqueued', async () => {
    queue = makeQueue();
    await queue.enqueue(event(1));
    expect(fetchMock()).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('sends batches of at most 50 events', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(Array.from({ length: 120 }, (_, i) => event(i))));
    queue = makeQueue();

    await queue.flush();

    expect(sentBatches().map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(sentBatches()[2][19].eventId).toBe('event-119');
    expect(queue.size).toBe(0);
  });

  it('keeps events and backs off exponentially on 5xx', async () => {
    fetchMock().mockResolvedValue(response(503));
    queue = makeQueue();
    await queue.enqueue(event(1));

    await queue.flush();
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);

    // Next wait is 4s
    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(3);
    expect(queue.size).toBe(1);

    fetchMock().mockResolvedValue(response(200));
    await jest.advanceTimersByTimeAsync(8000);
    expect(fetchMock()).toHaveBeenCalledTimes(4);
    expect(queue.size).toBe(0);
    expect(await stored()).toEqual([]);
  });

  it('honours Retry-After on 429', async () => {
    fetchMock().mockResolvedValueOnce(response(429, '10'));
    queue = makeQueue();
    await queue.enqueue(event(1));

    await queue.flush();
    await jest.advanceTimersByTimeAsync(9000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    // A flush during backoff waits for the retry time
    await queue.flush();
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it('retries network errors', async () => {
    fetchMock().mockRejectedValueOnce(new TypeError('Network request failed'));
    queue = makeQueue();
    await queue.enqueue(event(1));

    await queue.flush();
    expect(queue.size).toBe(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it('aborts a request after 15s and retries it', async () => {
    fetchMock().mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    );
    queue = makeQueue();
    await queue.enqueue(event(1));

    const flushing = queue.flush();
    await jest.advanceTimersByTimeAsync(15000);
    await flushing;
    expect(queue.size).toBe(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it('drops a batch rejected with another 4xx and continues', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(Array.from({ length: 60 }, (_, i) => event(i))));
    fetchMock().mockResolvedValueOnce(response(400));
    queue = makeQueue();

    await queue.flush();

    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith('ShortMetrics dropped 50 events: 400');
    expect(queue.size).toBe(0);
  });

  it('runs a single flush at a time', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchMock().mockImplementationOnce(() => new Promise((resolve) => (resolveFetch = resolve)));
    queue = makeQueue();
    await queue.enqueue(event(1));

    const first = queue.flush();
    const second = queue.flush();
    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();

    resolveFetch(response(200));
    await first;
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('caps the queue at 1000 events, dropping the oldest', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(Array.from({ length: 999 }, (_, i) => event(i))));
    queue = makeQueue(() => null);

    for (let i = 999; i < 1005; i++) await queue.enqueue(event(i));

    const saved = await stored();
    expect(saved).toHaveLength(1000);
    expect(saved[0].eventId).toBe('event-5');
    expect(saved[999].eventId).toBe('event-1004');
  });

  it('keeps events while there is no target, and flushes every 30s once started', async () => {
    let configured = false;
    queue = makeQueue(() => (configured ? target : null));
    queue.start();
    await queue.enqueue(event(1));

    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);

    configured = true;
    await jest.advanceTimersByTimeAsync(28000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0);
  });

  it('fills fields through prepare at flush time', async () => {
    queue = new EventQueue({
      getTarget: () => target,
      prepare: async (events) => events.map((e) => ({ ...e, installId: 'install-1' })),
    });
    await queue.enqueue(event(1));
    await queue.flush();

    expect(sentBatches()[0][0].installId).toBe('install-1');
    expect((await stored())).toEqual([]);
  });
});
