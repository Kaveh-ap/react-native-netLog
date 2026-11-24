import { describe, expect, it } from 'vitest';
import type { NetworkEntry } from 'react-native-netlog';
import { resourceTypeOf } from '../src/hiddenTypes';

const entry = (url: string, contentType?: string): NetworkEntry => ({
  id: 1,
  kind: 'xhr',
  method: 'GET',
  url,
  requestHeaders: {},
  responseHeaders: contentType ? { 'content-type': contentType } : {},
  startedAt: 0,
  state: 'done',
});

describe('resourceTypeOf', () => {
  it('uses the URL extension, ignoring query and case', () => {
    expect(resourceTypeOf(entry('https://cdn.example.com/a/b/banner.WEBP?w=300'))).toBe('webp');
    expect(resourceTypeOf(entry('https://x.test/anim.gif#frag'))).toBe('gif');
    expect(resourceTypeOf(entry('https://x.test/icon.svg'))).toBe('svg');
    expect(resourceTypeOf(entry('https://x.test/photo.jpeg'))).toBe('jpeg');
    expect(resourceTypeOf(entry('https://x.test/f/IRANYekan.woff2'))).toBe('font');
  });

  it('falls back to the response content-type', () => {
    expect(resourceTypeOf(entry('https://x.test/img/123', 'image/webp'))).toBe('webp');
    expect(resourceTypeOf(entry('https://x.test/img/123', 'image/svg+xml; charset=utf-8'))).toBe('svg');
    expect(resourceTypeOf(entry('https://x.test/f', 'font/woff2'))).toBe('font');
  });

  it('returns undefined for API calls', () => {
    expect(resourceTypeOf(entry('https://api.x.test/v1/cart', 'application/json'))).toBeUndefined();
    expect(resourceTypeOf(entry('https://api.x.test/v1.2/items'))).toBeUndefined();
    expect(resourceTypeOf(entry('https://x.test.svg/path'))).toBeUndefined();
  });
});
