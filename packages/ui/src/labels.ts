export interface NetLogLabels {
  title: string;
  /** e.g. (42, 3) => "42 requests · 3 errors" */
  summary: (total: number, errors: number) => string;
  searchPlaceholder: string;
  filterAll: string;
  filterErrors: string;
  filterSlow: string;
  filterPending: string;
  empty: string;
  emptyFiltered: string;
  pause: string;
  resume: string;
  paused: string;
  clear: string;
  exportHar: string;
  desktop: string;
  close: string;
  darkMode: string;
  lightMode: string;
  back: string;
  copyCurl: string;
  copied: string;
  share: string;
  resend: string;
  resent: string;
  tabOverview: string;
  tabRequest: string;
  tabResponse: string;
  tabTiming: string;
  general: string;
  initiator: string;
  headers: string;
  body: string;
  noBody: string;
  queued: string;
  waiting: string;
  download: string;
  total: string;
  timingNote: string;
  timingPending: string;
  tabRequests: string;
  tabSettings: string;
  appearance: string;
  light: string;
  dark: string;
  capture: string;
  recording: string;
  capturePaused: string;
  stored: (n: number) => string;
  exportTitle: string;
  exportHint: string;
  desktopTitle: string;
  limits: string;
  maxEntries: string;
  maxBodyLength: string;
  ignoreRules: string;
  redactedHeaders: string;
  hideFromList: string;
  hideHint: string;
  hideImages: string;
  showAll: string;
  /** e.g. 12 => "12 hidden by type filters" */
  hiddenNote: (n: number) => string;
  tabMocks: string;
  mocksSummary: (active: number, condition: string | null) => string;
  newRule: string;
  editRule: string;
  networkConditions: string;
  conditionOff: string;
  conditionSlow: string;
  conditionFlaky: string;
  conditionOffline: string;
  conditionHint: (c: 'off' | 'slow' | 'flaky' | 'offline') => string;
  rulesTitle: string;
  noRules: string;
  mocksHowItWorks: string;
  ruleEnabled: (n: number) => string;
  hits: (n: number) => string;
  off: string;
  edit: string;
  anyMethod: string;
  mockMethod: string;
  mockUrl: string;
  mockUrlHint: string;
  mockAction: string;
  actionRespond: string;
  actionDelay: string;
  actionFail: string;
  mockStatus: string;
  mockExtraDelay: string;
  mockDelayMs: string;
  mockDelayHint: string;
  mockNetworkError: string;
  mockTimeout: string;
  mockRespondLabel: (status: number) => string;
  mockDelayLabel: (ms: number) => string;
  deleteRule: string;
  cancel: string;
  save: string;
  mockThis: string;
  mocked: string;
  filterMocked: string;
  editResend: string;
  send: string;
  sending: string;
  addHeader: string;
  removeHeader: string;
  headerName: string;
  headerValue: string;
  resendResult: string;
  openRequest: string;
  resendFailed: string;
  tree: string;
  raw: string;
  validJson: string;
  invalidJson: string;
  formatJson: string;
}

export const defaultLabels: NetLogLabels = {
  title: 'NetLog',
  summary: (t, e) => `${t} ${t === 1 ? 'request' : 'requests'} · ${e} ${e === 1 ? 'error' : 'errors'}`,
  searchPlaceholder: 'Filter by URL, method or status',
  filterAll: 'All',
  filterErrors: 'Errors',
  filterSlow: 'Slow',
  filterPending: 'Pending',
  empty: 'No requests yet.',
  emptyFiltered: 'No requests match this filter.',
  pause: 'Pause',
  resume: 'Resume',
  paused: 'Capture paused. New requests aren’t recorded.',
  clear: 'Clear',
  exportHar: 'Share HAR',
  desktop: 'Desktop',
  close: 'Close',
  darkMode: 'Switch to dark mode',
  lightMode: 'Switch to light mode',
  back: 'Requests',
  copyCurl: 'Copy cURL',
  copied: 'Copied',
  share: 'Share',
  resend: 'Resend',
  resent: 'Sent',
  tabOverview: 'Overview',
  tabRequest: 'Request',
  tabResponse: 'Response',
  tabTiming: 'Timing',
  general: 'General',
  initiator: 'Initiator',
  headers: 'Headers',
  body: 'Body',
  noBody: 'No body',
  queued: 'Queued',
  waiting: 'Waiting for server',
  download: 'Download',
  total: 'Total',
  timingNote: 'Measured in JS from send() to load. DNS, TLS and connection time aren’t visible from JS.',
  timingPending: 'Waiting for response…',
  tabRequests: 'Requests',
  tabSettings: 'Settings',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  capture: 'Capture',
  recording: 'Recording requests',
  capturePaused: 'Paused',
  stored: (n) => `${n} ${n === 1 ? 'request' : 'requests'} stored`,
  exportTitle: 'Export',
  exportHint: 'All requests as a HAR file (opens in browser dev tools). Sensitive headers are masked.',
  desktopTitle: 'Desktop',
  limits: 'Limits',
  maxEntries: 'Max requests kept',
  maxBodyLength: 'Max body size',
  ignoreRules: 'Ignore rules',
  redactedHeaders: 'Masked headers',
  hideFromList: 'Hide from list',
  hideHint: 'Still recorded and exported, just not listed.',
  hideImages: 'Hide all images',
  showAll: 'Show all',
  hiddenNote: (n) => `${n} hidden by type filters`,
  tabMocks: 'Mocks',
  mocksSummary: (a, c) => `${a} ${a === 1 ? 'rule' : 'rules'} active${c ? ` · network: ${c}` : ''}`,
  newRule: 'New rule',
  editRule: 'Edit rule',
  networkConditions: 'Network conditions',
  conditionOff: 'Off',
  conditionSlow: 'Slow 3G',
  conditionFlaky: 'Flaky',
  conditionOffline: 'Offline',
  conditionHint: (c) =>
    ({
      off: 'Requests go out normally.',
      slow: 'Every request waits 2 s first.',
      flaky: '10% of requests fail with a network error.',
      offline: 'Every request fails with a network error. Mock rules still answer.',
    })[c],
  rulesTitle: 'Rules · first match wins',
  noRules: 'No rules yet. Tap New rule, or open a request and tap Mock this.',
  mocksHowItWorks: 'Rules run inside the app before a request leaves. Matched requests show a MOCK badge in the list.',
  ruleEnabled: (n) => `Rule ${n} enabled`,
  hits: (n) => `${n} ${n === 1 ? 'hit' : 'hits'} this session`,
  off: 'Off',
  edit: 'Edit',
  anyMethod: 'ANY',
  mockMethod: 'Method',
  mockUrl: 'URL pattern',
  mockUrlHint: 'Use * as a wildcard (*/v1/cart/*). Without *, matches any URL that contains the text.',
  mockAction: 'Action',
  actionRespond: 'Respond',
  actionDelay: 'Delay',
  actionFail: 'Fail',
  mockStatus: 'Status',
  mockExtraDelay: 'Delay (ms)',
  mockDelayMs: 'Delay (ms)',
  mockDelayHint: 'Waits, then sends the real request.',
  mockNetworkError: 'Network error',
  mockTimeout: 'Timeout',
  mockRespondLabel: (s) => `Respond ${s}`,
  mockDelayLabel: (ms) => `Delay ${ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`}`,
  deleteRule: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  mockThis: 'Mock this',
  mocked: 'MOCK',
  filterMocked: 'Mocked',
  editResend: 'Edit & resend',
  send: 'Send request',
  sending: 'Sending…',
  addHeader: '+ Add header',
  removeHeader: 'Remove header',
  headerName: 'Name',
  headerValue: 'Value',
  resendResult: 'Result',
  openRequest: 'Open in Requests',
  resendFailed: 'Could not send',
  tree: 'Tree',
  raw: 'Raw',
  validJson: 'Valid JSON',
  invalidJson: 'Invalid JSON',
  formatJson: 'Format',
};
