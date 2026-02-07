/**
 * Diff utilities — ported from the plugin's buildDiffLines logic.
 * Compares two Figma JSON snapshots and produces human-readable diff lines.
 */
import pkg from 'deep-diff';
const { diff: deepDiff } = pkg;

export interface DiffLine {
  type: 'added' | 'changed' | 'removed';
  text: string;
}

// Noise fields to skip in diff output
const SKIP_FIELDS = new Set([
  'id', 'key', 'transitionNodeID', 'prototypeStartNodeID',
  'flowStartingPoints', 'prototypeDevice', 'absoluteBoundingBox',
  'absoluteRenderBounds', 'relativeTransform', 'size',
]);

// Friendly labels for Figma properties
const PROP_NAMES: Record<string, string> = {
  paddingLeft: 'padding-left', paddingRight: 'padding-right',
  paddingTop: 'padding-top', paddingBottom: 'padding-bottom',
  itemSpacing: 'item spacing', counterAxisSpacing: 'cross-axis spacing',
  cornerRadius: 'corner radius', topLeftRadius: 'top-left radius',
  topRightRadius: 'top-right radius', bottomLeftRadius: 'bottom-left radius',
  bottomRightRadius: 'bottom-right radius',
  layoutMode: 'layout mode', primaryAxisSizingMode: 'primary axis sizing',
  counterAxisSizingMode: 'counter axis sizing',
  primaryAxisAlignItems: 'main axis align', counterAxisAlignItems: 'cross axis align',
  opacity: 'opacity', visible: 'visibility', blendMode: 'blend mode',
  clipsContent: 'clip content', characters: 'text content',
  fontSize: 'font size', fontFamily: 'font family', fontWeight: 'font weight',
  textAlignHorizontal: 'text align', lineHeightPx: 'line height',
  letterSpacing: 'letter spacing', strokeWeight: 'stroke weight',
  strokeAlign: 'stroke alignment', componentPropertyDefinitions: 'component properties',
};

function formatColor(c: any): string {
  if (!c || typeof c !== 'object') return String(c);
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  if (a < 1) return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function resolveAtPath(obj: any, path: (string | number)[]): any {
  let cur = obj;
  for (const seg of path) { if (cur == null) return undefined; cur = cur[seg]; }
  return cur;
}

function findNodeName(obj: any, path: (string | number)[]): string {
  let cur = obj, name = '';
  for (const seg of path) {
    if (cur == null) break;
    cur = cur[seg];
    if (cur?.name) name = cur.name;
  }
  return name;
}

function prettyProp(key: string): string {
  return PROP_NAMES[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

function prettyVal(v: any): string {
  if (v == null) return 'none';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.length > 50 ? v.slice(0, 47) + '...' : v;
  if (typeof v === 'object') {
    if ('r' in v && 'g' in v && 'b' in v) return formatColor(v);
    if ('type' in v) return String(v.type);
    const s = JSON.stringify(v);
    return s.length > 50 ? s.slice(0, 47) + '...' : s;
  }
  return String(v);
}

/** Build human-readable diff lines from two JSON snapshots. */
export function buildDiffLines(oldSnap: any, newSnap: any): DiffLine[] {
  if (!oldSnap || !newSnap) return [];
  const diffs = deepDiff(oldSnap, newSnap);
  if (!diffs) return [];

  const lines: DiffLine[] = [];
  const seen = new Set<string>();
  const colorPaths = new Set<string>();

  for (const d of diffs) {
    const path: (string | number)[] = d.path || [];
    if (path.length === 0) continue;

    // Skip noise fields
    if (path.some(seg => typeof seg === 'string' && SKIP_FIELDS.has(seg))) continue;

    // Group RGBA components into single color change
    const last = path[path.length - 1];
    if (typeof last === 'string' && ['r', 'g', 'b', 'a'].includes(last)) {
      const cPath = path.slice(0, -1);
      const cKey = cPath.join('.');
      if (colorPaths.has(cKey)) continue;
      colorPaths.add(cKey);
      const oldC = resolveAtPath(oldSnap, cPath);
      const newC = resolveAtPath(newSnap, cPath);
      const node = findNodeName(oldSnap, cPath) || findNodeName(newSnap, cPath);
      const ctx = cPath.find(s => typeof s === 'string' && ['strokes', 'effects'].includes(s));
      const label = ctx === 'strokes' ? 'stroke color' : ctx === 'effects' ? 'effect color' : 'fill color';
      const pre = node ? `${node}: ` : '';
      const text = `${pre}${label}: ${formatColor(oldC)} → ${formatColor(newC)}`;
      if (!seen.has(text)) { seen.add(text); lines.push({ type: 'changed', text }); }
      continue;
    }

    // Split path into node context + property
    let nodeParts: (string | number)[] = [];
    let propParts: string[] = [];
    const knownProps = new Set([...Object.keys(PROP_NAMES), 'fills', 'strokes', 'effects', 'style', 'children']);
    for (let i = 0; i < path.length; i++) {
      if (typeof path[i] === 'string' && knownProps.has(path[i] as string)) {
        nodeParts = path.slice(0, i);
        propParts = path.slice(i).map(String);
        break;
      }
    }
    if (propParts.length === 0) {
      nodeParts = path.slice(0, -1);
      propParts = [String(path[path.length - 1])];
    }

    const nodeName = findNodeName(oldSnap, nodeParts) || findNodeName(newSnap, nodeParts);
    const pre = nodeName ? `${nodeName}: ` : '';
    const prop = prettyProp(propParts[0]) + (propParts.length > 1 ? '.' + propParts.slice(1).join('.') : '');

    let text = '';
    let type: DiffLine['type'] = 'changed';

    switch (d.kind) {
      case 'N': {
        type = 'added';
        const v = d.rhs;
        text = (v?.name && v?.type) ? `added ${v.type}: "${v.name}"` : `${pre}added ${prop}`;
        break;
      }
      case 'D': {
        type = 'removed';
        const v = d.lhs;
        text = (v?.name && v?.type) ? `removed ${v.type}: "${v.name}"` : `${pre}removed ${prop}`;
        break;
      }
      case 'E':
        type = 'changed';
        text = `${pre}${prop}: ${prettyVal(d.lhs)} → ${prettyVal(d.rhs)}`;
        break;
      case 'A':
        if (d.item?.kind === 'N') {
          type = 'added';
          const name = d.item?.rhs?.name;
          text = name ? `${pre}added ${propParts[0]}: "${name}"` : `${pre}added ${prop}[${d.index}]`;
        } else if (d.item?.kind === 'D') {
          type = 'removed';
          const name = d.item?.lhs?.name;
          text = name ? `${pre}removed ${propParts[0]}: "${name}"` : `${pre}removed ${prop}[${d.index}]`;
        } else {
          type = 'changed';
          text = `${pre}changed ${prop}[${d.index}]`;
        }
        break;
    }

    if (text && !seen.has(text)) { seen.add(text); lines.push({ type, text }); }
  }

  // Sort: added first, then changed, then removed
  const order = { added: 0, changed: 1, removed: 2 };
  lines.sort((a, b) => order[a.type] - order[b.type]);
  return lines.slice(0, 80);
}
