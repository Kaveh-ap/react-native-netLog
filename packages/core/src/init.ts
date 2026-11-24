import { configure, type NetLogConfig, type NetLogConfigInput } from './config';
import { startCapture } from './xhr';

export type InitNetLogOptions = NetLogConfigInput & {
  /** Start recording requests right away. Default true. */
  capture?: boolean;
};

/**
 * One-call setup: applies the config, then starts capture.
 * Safe to call more than once (later calls update the config).
 *
 * ```ts
 * initNetLog({ features: { qrPairing: false }, ignore: [/\/symbolicate$/] });
 * ```
 */
export function initNetLog(options: InitNetLogOptions = {}): NetLogConfig {
  const { capture = true, ...config } = options;
  const result = configure(config);
  if (capture) startCapture();
  return result;
}
