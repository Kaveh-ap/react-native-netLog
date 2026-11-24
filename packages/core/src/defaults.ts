import type { NetLogConfig } from './config';

export function defaultConfig(): NetLogConfig {
  return {
    features: { qrPairing: true },
    maxEntries: 500,
    maxBodyLength: 1024 * 1024,
    ignore: [],
    captureStack: true,
    redactHeaders: ['authorization', 'cookie', 'set-cookie'],
  };
}
