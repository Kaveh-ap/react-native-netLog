# @netlog/json-viewer

A fast, searchable JSON tree viewer for React Native. No native code, no dependencies.

- Collapsible tree with line numbers and type colors
- Search keys and/or values, match count, next/previous, auto-expands to matches
- Tap a value to see its path (`$.data.items[0].price`) and copy path or value
- Virtualized rows: half a million nodes stay scrollable
- Always left-to-right, even inside RTL apps
- Light and dark themes, overridable tokens and labels

## Usage

```tsx
import { JsonViewer } from '@netlog/json-viewer';
import Clipboard from '@react-native-clipboard/clipboard';

<JsonViewer
  json={responseText}           // or data={parsedValue}
  initialExpandDepth={2}
  theme="light"
  onCopy={(text) => Clipboard.setString(text)}
/>
```

`onCopy` is how you plug in your clipboard library; the Copy buttons are hidden without it.

| Prop | Default | |
|---|---|---|
| `data` / `json` | | Parsed value, or a JSON string (invalid JSON shows raw text) |
| `initialExpandDepth` | `2` | Containers shallower than this start open |
| `searchable` | `true` | Show the search bar |
| `initialQuery`, `initialScope` | `''`, `'all'` | Scope: `all`, `keys`, `values` |
| `caseSensitive` | `false` | |
| `theme` | `'light'` | `'light'`, `'dark'`, or partial theme tokens |
| `labels` | English | Override any UI string |
| `showLineNumbers` | `true` | |
| `maxValueLength` | `200` | Display cut-off; copy uses the full value |
| `rowHeight`, `indent` | `24`, `14` | |
| `pathRoot` | `'$'` | Root of copied paths |
| `onCopy(text, kind)` | | `kind` is `'path'` or `'value'` |
| `onSelect(selection)` | | `{ path, value }` |

## Core (no React)

`@netlog/json-viewer/core` holds the logic, so the same tree, search and paths work in a web viewer or in tests:

```ts
import { buildTree, expandedToDepth, visibleRows, searchTree, reveal, getPath } from '@netlog/json-viewer/core';

const tree = buildTree(value);
const hits = searchTree(tree, 'stock', { scope: 'all' });
const expanded = reveal(tree, expandedToDepth(tree, 2), hits);
const rows = visibleRows(tree, expanded); // what to render
getPath(tree, hits[0]); // "$.data.product.variants[0].stock"
```

`useJsonViewer()` (React only, no React Native) wraps that state for any React renderer.

## Performance

Measured in Node on an Apple Silicon Mac (`npm run bench`); expect Hermes on a mid-range phone to be several times slower:

| Payload | Nodes | Build | Search (first / repeat) | Expand all |
|---|---|---|---|---|
| 0.7 MB | 46k | 11 ms | 10 ms / 1 ms | 8 ms |
| 7.4 MB | 460k | 90 ms | 126 ms / 8 ms | 108 ms |

## Development

```bash
npm test          # unit tests
npm run typecheck
npm run bench     # performance numbers
```
