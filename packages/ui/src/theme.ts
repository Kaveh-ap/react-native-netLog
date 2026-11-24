import { Platform } from 'react-native';

export interface NetLogTheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  /** Line between list rows. */
  separator: string;
  text: string;
  muted: string;
  accent: string;
  primary: string;
  onPrimary: string;
  selected: string;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  error: string;
  errorBg: string;
  neutral: string;
  neutralBg: string;
  info: string;
  infoBg: string;
  methods: Record<string, string>;
  timing: { queued: string; waiting: string; download: string };
  mono: string;
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const netLogLight: NetLogTheme = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F4F7',
  border: '#EAECF0',
  separator: '#D0D5DD',
  text: '#101828',
  muted: '#475467',
  accent: '#175CD3',
  primary: '#101828',
  onPrimary: '#FFFFFF',
  selected: '#EFF4FF',
  ok: '#067647',
  okBg: '#ECFDF3',
  warn: '#B54708',
  warnBg: '#FFFAEB',
  error: '#B42318',
  errorBg: '#FEF3F2',
  neutral: '#475467',
  neutralBg: '#F2F4F7',
  info: '#175CD3',
  infoBg: '#EFF8FF',
  methods: { GET: '#175CD3', POST: '#6941C6', PUT: '#B54708', PATCH: '#B54708', DELETE: '#B42318' },
  timing: { queued: '#98A2B3', waiting: '#1D4ED8', download: '#47CD89' },
  mono,
};

export const netLogDark: NetLogTheme = {
  background: '#0C111D',
  surface: '#161B26',
  surfaceAlt: '#1F242F',
  border: '#1F242F',
  separator: '#333741',
  text: '#F5F5F6',
  muted: '#94969C',
  accent: '#84ADFF',
  primary: '#F5F5F6',
  onPrimary: '#0C111D',
  selected: '#102A56',
  ok: '#75E0A7',
  okBg: '#053321',
  warn: '#FEC84B',
  warnBg: '#4E1D09',
  error: '#FDA29B',
  errorBg: '#55160C',
  neutral: '#CECFD2',
  neutralBg: '#1F242F',
  info: '#84CAFF',
  infoBg: '#102A56',
  methods: { GET: '#84CAFF', POST: '#BDB4FE', PUT: '#FEC84B', PATCH: '#FEC84B', DELETE: '#FDA29B' },
  timing: { queued: '#61646C', waiting: '#528BFF', download: '#47CD89' },
  mono,
};

export function resolveNetLogTheme(theme: 'light' | 'dark' | Partial<NetLogTheme> | undefined): NetLogTheme {
  if (theme === 'dark') return netLogDark;
  if (theme === undefined || theme === 'light') return netLogLight;
  return { ...netLogLight, ...theme };
}
