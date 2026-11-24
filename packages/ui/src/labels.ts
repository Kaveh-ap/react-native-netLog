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
};
