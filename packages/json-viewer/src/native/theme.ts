import { Platform } from 'react-native';

export interface JsonViewerTheme {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  lineNumber: string;
  key: string;
  index: string;
  string: string;
  number: string;
  boolean: string;
  null: string;
  punctuation: string;
  /** Background of matched text. */
  match: string;
  /** Background of matched text in the current match. */
  matchCurrent: string;
  matchText: string;
  currentRow: string;
  selectedRow: string;
  accent: string;
  inputBackground: string;
  monoFontFamily: string;
  fontFamily?: string;
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const lightTheme: JsonViewerTheme = {
  background: '#FCFCFD',
  surface: '#FFFFFF',
  border: '#EAECF0',
  text: '#101828',
  muted: '#475467',
  lineNumber: '#98A2B3',
  key: '#344054',
  index: '#667085',
  string: '#067647',
  number: '#175CD3',
  boolean: '#6941C6',
  null: '#6941C6',
  punctuation: '#475467',
  match: '#FEF0C7',
  matchCurrent: '#FDB022',
  matchText: '#101828',
  currentRow: '#FFFAEB',
  selectedRow: '#EFF4FF',
  accent: '#175CD3',
  inputBackground: '#F2F4F7',
  monoFontFamily: mono,
};

export const darkTheme: JsonViewerTheme = {
  background: '#0C111D',
  surface: '#161B26',
  border: '#1F242F',
  text: '#F5F5F6',
  muted: '#94969C',
  lineNumber: '#61646C',
  key: '#CECFD2',
  index: '#94969C',
  string: '#75E0A7',
  number: '#84CAFF',
  boolean: '#BDB4FE',
  null: '#BDB4FE',
  punctuation: '#94969C',
  match: '#4E1D09',
  matchCurrent: '#F79009',
  matchText: '#FFFFFF',
  currentRow: '#2A1A0B',
  selectedRow: '#102A56',
  accent: '#84ADFF',
  inputBackground: '#1F242F',
  monoFontFamily: mono,
};

export function resolveTheme(theme: 'light' | 'dark' | Partial<JsonViewerTheme> | undefined): JsonViewerTheme {
  if (theme === 'dark') return darkTheme;
  if (theme === undefined || theme === 'light') return lightTheme;
  return { ...lightTheme, ...theme };
}
