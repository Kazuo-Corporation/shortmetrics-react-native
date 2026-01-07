import { useEffect } from 'react';
import { ShortMetrics } from './ShortMetrics';
import type { ShortMetricsConfig } from './types';

/**
 * React hook for ShortMetrics tracking
 * Configures and initializes the ShortMetrics singleton
 * @param config ShortMetrics configuration
 * @returns ShortMetrics singleton instance
 */
export function useShortMetrics(config: ShortMetricsConfig) {
  useEffect(() => {
    // Configure the singleton on mount
    ShortMetrics.configure(config);
    ShortMetrics.initialize();

    // Cleanup on unmount
    return () => {
      ShortMetrics.reset();
    };
  }, [config.apiKey, config.endpoint]);

  return ShortMetrics;
}

