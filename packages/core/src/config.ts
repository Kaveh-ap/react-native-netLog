import { defaultConfig } from './defaults';
import { netlogGlobal } from './global';

export interface NetLogFeatures {
  /**
   * Desktop pairing: scan the QR code (or type the pairing code) shown by
   * `netlog-desktop` and stream traffic to it. When false, the pairing UI is
   * not rendered and pairing calls throw `NetLogFeatureDisabledError`.
   * Default: true.
   */
  qrPairing: boolean;
}

export type IgnoreRule = RegExp | ((method: string, url: string) => boolean);

export interface NetLogConfig {
  features: NetLogFeatures;
  /** Oldest entries are dropped past this. Default 500. */
  maxEntries: number;
  /** Request/response bodies are cut to this many characters. Default 1 MB. */
  maxBodyLength: number;
  /** Skipped requests. A RegExp is tested against `"METHOD url"`. */
  ignore: IgnoreRule[];
  /** Record the JS stack at send() to show which code fired a request. Default true. */
  captureStack: boolean;
  /** Header names (case-insensitive) masked when entries leave the device. Default: authorization, cookie. */
  redactHeaders: string[];
}

export type NetLogConfigInput = Partial<Omit<NetLogConfig, 'features'>> & {
  features?: Partial<NetLogFeatures>;
};

export const DEFAULT_CONFIG: Readonly<NetLogConfig> = defaultConfig();

/** Merge options into the current config. Safe to call more than once. */
export function configure(input: NetLogConfigInput): NetLogConfig {
  const g = netlogGlobal();
  g.config = {
    ...g.config,
    ...input,
    features: { ...g.config.features, ...input.features },
  };
  for (const l of g.configListeners) l(g.config);
  return g.config;
}

export function getConfig(): NetLogConfig {
  return netlogGlobal().config;
}

export function isFeatureEnabled(name: keyof NetLogFeatures): boolean {
  return netlogGlobal().config.features[name];
}

export function subscribeConfig(listener: (config: NetLogConfig) => void): () => void {
  const set = netlogGlobal().configListeners;
  set.add(listener);
  return () => set.delete(listener);
}

export class NetLogFeatureDisabledError extends Error {
  constructor(public readonly feature: keyof NetLogFeatures) {
    super(`netlog: the "${feature}" feature is disabled (configure({ features: { ${feature}: true } }))`);
    this.name = 'NetLogFeatureDisabledError';
  }
}

export function assertFeature(name: keyof NetLogFeatures): void {
  if (!isFeatureEnabled(name)) throw new NetLogFeatureDisabledError(name);
}
