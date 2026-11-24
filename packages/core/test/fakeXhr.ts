/** Minimal XMLHttpRequest stand-in that answers with a scripted response. */
export interface FakeResponse {
  status: number;
  headers?: string;
  body?: string;
  fail?: 'error' | 'timeout' | 'abort';
  /** 'blob' mimics React Native's fetch(). */
  responseType?: '' | 'blob';
}

export class FakeXHR {
  static next: FakeResponse = { status: 200, body: '' };
  readyState = 0;
  status = 0;
  responseType = '';
  responseText = '';
  response: unknown = '';
  private headers = '';
  private listeners: Record<string, Array<() => void>> = {};

  open(_method: string, _url: string) {
    this.readyState = 1;
  }
  setRequestHeader(_k: string, _v: string) {}
  getAllResponseHeaders() {
    return this.headers;
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  private fire(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
  send(_body?: unknown) {
    const r = FakeXHR.next;
    if (r.fail) {
      this.readyState = 4;
      this.fire('readystatechange');
      this.fire(r.fail);
      return;
    }
    this.status = r.status;
    this.headers = r.headers ?? '';
    this.readyState = 2;
    this.fire('readystatechange');
    this.responseType = r.responseType ?? '';
    this.responseText = r.responseType === 'blob' ? '' : r.body ?? '';
    this.response = r.responseType === 'blob' ? new Blob([r.body ?? '']) : this.responseText;
    this.readyState = 4;
    this.fire('readystatechange');
    this.fire('load');
  }
}

export function request(method: string, url: string, body?: string, headers: Record<string, string> = {}) {
  const xhr = new (globalThis as unknown as { XMLHttpRequest: typeof FakeXHR }).XMLHttpRequest();
  xhr.open(method, url);
  for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
  xhr.send(body);
  return xhr;
}
