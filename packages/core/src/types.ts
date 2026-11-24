export type EntryState = 'pending' | 'done' | 'error';

export interface NetworkEntry {
  /** Unique per app run. */
  id: number;
  kind: 'xhr';
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseType?: string;
  /** Epoch ms. */
  startedAt: number;
  /** When response headers arrived (time to first byte). */
  headersAt?: number;
  endedAt?: number;
  durationMs?: number;
  state: EntryState;
  /** 'Network error', 'Timeout', 'Aborted'. */
  error?: string;
  /** JS stack at send() time, when `captureStack` is on. */
  initiator?: string;
  /** Set when a mock rule or network condition changed this request. */
  mocked?: { ruleId?: string; label: string };
}

export type StoreEvent =
  | { type: 'add'; entry: NetworkEntry }
  | { type: 'update'; entry: NetworkEntry }
  | { type: 'clear' };

export type StoreListener = (event: StoreEvent) => void;
