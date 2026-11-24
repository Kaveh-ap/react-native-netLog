import fs from 'node:fs';

// The browser viewer is one self-contained page (viewer.html), no build step.
// All device data is rendered with textContent, or HTML-escaped before highlighting.
let html;

export function viewerHtml() {
  html ??= fs.readFileSync(new URL('./viewer.html', import.meta.url), 'utf8');
  return html;
}
