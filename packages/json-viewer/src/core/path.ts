import type { JsonTree } from './tree';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface PathOptions {
  /** Root symbol. Default `$`. */
  root?: string;
}

/** JS-style accessor path, e.g. `$.data.items[0]["content-type"]`. */
export function getPath(tree: JsonTree, id: number, options: PathOptions = {}): string {
  const parts: string[] = [];
  let n = tree.nodes[id];
  while (n && n.parent >= 0) {
    const k = n.key;
    if (typeof k === 'number') parts.push(`[${k}]`);
    else if (k !== undefined && IDENTIFIER.test(k)) parts.push(`.${k}`);
    else parts.push(`[${JSON.stringify(k)}]`);
    n = tree.nodes[n.parent];
  }
  return (options.root ?? '$') + parts.reverse().join('');
}
