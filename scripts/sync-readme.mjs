// Builds packages/core/README.md (the npm landing page for react-native-netlog)
// from the root README, with absolute links and images so they work on npmjs.com.
import fs from 'node:fs';

const REPO = 'https://github.com/Kaveh-ap/react-native-netLog';
const RAW = 'https://raw.githubusercontent.com/Kaveh-ap/react-native-netLog/main';

const root = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const out = root
  .replace(/(src=")docs\//g, `$1${RAW}/docs/`)
  .replace(/\]\(packages\/([^)]+)\)/g, `](${REPO}/tree/main/packages/$1)`)
  .replace(/\]\(LICENSE\)/g, `](${REPO}/blob/main/LICENSE)`)
  .replace(/(href=")LICENSE(")/g, `$1${REPO}/blob/main/LICENSE$2`);

const header = '<!-- Generated from the root README by scripts/sync-readme.mjs. Edit the root README instead. -->\n';
fs.writeFileSync(new URL('../packages/core/README.md', import.meta.url), header + out);
console.log('packages/core/README.md updated');
