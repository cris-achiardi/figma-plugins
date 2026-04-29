import { UIMessage, CodeMessage, SelectionInfo } from './types';
import { reconstructFromSnapshot } from './reconstruct';

figma.showUI(__html__, { width: 420, height: 520 });

// ── Structured property type + variable cache ────────────

type PropEntry = { prop: string; value: string };

const varCache = new Map<string, string | null>();

async function resolveVarName(id: string): Promise<string | null> {
  if (varCache.has(id)) return varCache.get(id)!;
  const v = await figma.variables.getVariableByIdAsync(id);
  const name = v ? v.name.replace(/\//g, '-') : null;
  varCache.set(id, name);
  return name;
}

function withVar(varName: string | null, rawValue: string): string {
  return varName ? `var(--${varName}, ${rawValue})` : rawValue;
}

// ── Color helpers ────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function paintToStr(paint: Paint): string | null {
  if (paint.visible === false) return null;
  if (paint.type === 'SOLID') {
    const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
    return paint.opacity != null && paint.opacity < 1
      ? `${hex} ${Math.round(paint.opacity * 100)}%`
      : hex;
  }
  if (paint.type.startsWith('GRADIENT')) return 'gradient';
  if (paint.type === 'IMAGE') return 'image';
  return null;
}

function formatPadding(t: number, r: number, b: number, l: number): string {
  if (t === r && r === b && b === l) return `${t}px`;
  if (t === b && l === r) return `${t}px ${r}px`;
  return `${t}px ${r}px ${b}px ${l}px`;
}

// ── Property extractors ─────────────────────────────────

async function getSizeProps(node: SceneNode): Promise<PropEntry[]> {
  const props: PropEntry[] = [];
  const n = node as any;
  const bv = (node as any).boundVariables || {};

  if (n.layoutSizingHorizontal === 'HUG') {
    props.push({ prop: 'width', value: 'hug' });
  } else if (n.layoutSizingHorizontal === 'FILL') {
    props.push({ prop: 'width', value: 'fill' });
  } else {
    const raw = `${Math.round(node.width)}px`;
    const varName = bv.width ? await resolveVarName(bv.width.id) : null;
    props.push({ prop: 'width', value: withVar(varName, raw) });
  }

  if (n.layoutSizingVertical === 'HUG') {
    props.push({ prop: 'height', value: 'hug' });
  } else if (n.layoutSizingVertical === 'FILL') {
    props.push({ prop: 'height', value: 'fill' });
  } else {
    const raw = `${Math.round(node.height)}px`;
    const varName = bv.height ? await resolveVarName(bv.height.id) : null;
    props.push({ prop: 'height', value: withVar(varName, raw) });
  }

  return props;
}

async function getLayoutProps(node: SceneNode): Promise<PropEntry[]> {
  const props: PropEntry[] = [];
  if (!('layoutMode' in node)) return props;
  const f = node as FrameNode;
  if (f.layoutMode === 'NONE') return props;
  const bv = (f as any).boundVariables || {};

  if (f.layoutMode === 'HORIZONTAL') {
    props.push({ prop: 'display', value: 'flex' });
  } else {
    props.push({ prop: 'display', value: 'flex' });
    props.push({ prop: 'flex-direction', value: 'column' });
  }

  if (f.layoutWrap === 'WRAP') props.push({ prop: 'flex-wrap', value: 'wrap' });

  const justify: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between',
  };
  if (justify[f.primaryAxisAlignItems]) {
    props.push({ prop: 'justify-content', value: justify[f.primaryAxisAlignItems] });
  }

  const align: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline',
  };
  if (align[f.counterAxisAlignItems]) {
    props.push({ prop: 'align-items', value: align[f.counterAxisAlignItems] });
  }

  if (f.itemSpacing > 0) {
    const raw = `${f.itemSpacing}px`;
    const varName = bv.itemSpacing ? await resolveVarName(bv.itemSpacing.id) : null;
    props.push({ prop: 'gap', value: withVar(varName, raw) });
  }

  const pt = f.paddingTop || 0, pr = f.paddingRight || 0;
  const pb = f.paddingBottom || 0, pl = f.paddingLeft || 0;
  if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
    // Resolve individual padding variables
    const ptVar = bv.paddingTop ? await resolveVarName(bv.paddingTop.id) : null;
    const prVar = bv.paddingRight ? await resolveVarName(bv.paddingRight.id) : null;
    const pbVar = bv.paddingBottom ? await resolveVarName(bv.paddingBottom.id) : null;
    const plVar = bv.paddingLeft ? await resolveVarName(bv.paddingLeft.id) : null;

    // If all padding vars are the same single token, use shorthand
    if (ptVar && ptVar === prVar && prVar === pbVar && pbVar === plVar) {
      props.push({ prop: 'padding', value: withVar(ptVar, formatPadding(pt, pr, pb, pl)) });
    } else if (ptVar || prVar || pbVar || plVar) {
      // Output individual padding props when variables differ
      if (pt > 0 || ptVar) props.push({ prop: 'padding-top', value: withVar(ptVar, `${pt}px`) });
      if (pr > 0 || prVar) props.push({ prop: 'padding-right', value: withVar(prVar, `${pr}px`) });
      if (pb > 0 || pbVar) props.push({ prop: 'padding-bottom', value: withVar(pbVar, `${pb}px`) });
      if (pl > 0 || plVar) props.push({ prop: 'padding-left', value: withVar(plVar, `${pl}px`) });
    } else {
      props.push({ prop: 'padding', value: formatPadding(pt, pr, pb, pl) });
    }
  }

  return props;
}

async function getAppearanceProps(node: SceneNode): Promise<PropEntry[]> {
  const props: PropEntry[] = [];
  const bv = (node as any).boundVariables || {};

  // Corner radius
  if ('cornerRadius' in node) {
    const r = (node as any).cornerRadius;
    if (r === figma.mixed) {
      const n = node as FrameNode;
      // Try to resolve individual corner variables
      const tlVar = bv.topLeftRadius ? await resolveVarName(bv.topLeftRadius.id) : null;
      const trVar = bv.topRightRadius ? await resolveVarName(bv.topRightRadius.id) : null;
      const brVar = bv.bottomRightRadius ? await resolveVarName(bv.bottomRightRadius.id) : null;
      const blVar = bv.bottomLeftRadius ? await resolveVarName(bv.bottomLeftRadius.id) : null;
      const tl = withVar(tlVar, `${n.topLeftRadius}px`);
      const tr = withVar(trVar, `${n.topRightRadius}px`);
      const br = withVar(brVar, `${n.bottomRightRadius}px`);
      const bl = withVar(blVar, `${n.bottomLeftRadius}px`);
      props.push({ prop: 'border-radius', value: `${tl} ${tr} ${br} ${bl}` });
    } else if (typeof r === 'number' && r > 0) {
      const varName = bv.topLeftRadius ? await resolveVarName(bv.topLeftRadius.id) : null;
      props.push({ prop: 'border-radius', value: withVar(varName, `${r}px`) });
    }
  }

  // Strokes → border
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes;
    if (Array.isArray(strokes)) {
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (s.visible === false) continue;
        if (s.type === 'SOLID') {
          const hex = rgbToHex(s.color.r, s.color.g, s.color.b);
          const w = (node as GeometryMixin).strokeWeight;
          const weight = typeof w === 'number' ? w : 1;

          // Resolve stroke color variable
          const strokeVarId = bv.strokes?.[i]?.id;
          const strokeVarName = strokeVarId ? await resolveVarName(strokeVarId) : null;
          const colorStr = withVar(strokeVarName, hex);

          // Resolve stroke weight variable
          const swVarId = bv.strokeWeight?.id;
          const swVarName = swVarId ? await resolveVarName(swVarId) : null;
          const weightStr = swVarName ? withVar(swVarName, `${weight}px`) : `${weight}px`;

          props.push({ prop: 'border', value: `${weightStr} solid ${colorStr}` });
          break;
        }
      }
    }
  }

  // Fills → background (skip text nodes, they use color instead)
  if ('fills' in node && node.type !== 'TEXT') {
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills)) {
      for (let i = 0; i < fills.length; i++) {
        const f = fills[i];
        const str = paintToStr(f);
        if (str) {
          const fillVarId = bv.fills?.[i]?.id;
          const fillVarName = fillVarId ? await resolveVarName(fillVarId) : null;
          props.push({ prop: 'background', value: withVar(fillVarName, str) });
          break;
        }
      }
    }
  }

  // Opacity
  if ('opacity' in node && (node as any).opacity < 1) {
    const raw = `${Math.round((node as any).opacity * 100)}%`;
    const varName = bv.opacity ? await resolveVarName(bv.opacity.id) : null;
    props.push({ prop: 'opacity', value: withVar(varName, raw) });
  }

  // Effects
  if ('effects' in node) {
    for (const fx of (node as BlendMixin).effects) {
      if (!fx.visible) continue;
      if (fx.type === 'DROP_SHADOW') {
        const hex = rgbToHex(fx.color.r, fx.color.g, fx.color.b);
        props.push({ prop: 'box-shadow', value: `${fx.offset.x}px ${fx.offset.y}px ${fx.radius}px ${hex}` });
      } else if (fx.type === 'INNER_SHADOW') {
        const hex = rgbToHex(fx.color.r, fx.color.g, fx.color.b);
        props.push({ prop: 'box-shadow', value: `inset ${fx.offset.x}px ${fx.offset.y}px ${fx.radius}px ${hex}` });
      } else if (fx.type === 'LAYER_BLUR') {
        props.push({ prop: 'filter', value: `blur(${fx.radius}px)` });
      } else if (fx.type === 'BACKGROUND_BLUR') {
        props.push({ prop: 'backdrop-filter', value: `blur(${fx.radius}px)` });
      }
    }
  }

  return props;
}

async function getTextProps(node: TextNode): Promise<PropEntry[]> {
  const props: PropEntry[] = [];
  const bv = (node as any).boundVariables || {};

  if (node.fontName !== figma.mixed) {
    props.push({ prop: 'font-family', value: node.fontName.family });
    const style = node.fontName.style.toLowerCase();
    let weight = '400';
    if (style.includes('black')) weight = '900';
    else if (style.includes('extrabold')) weight = '800';
    else if (style.includes('bold')) weight = '700';
    else if (style.includes('semibold')) weight = '600';
    else if (style.includes('medium')) weight = '500';
    else if (style.includes('light')) weight = '300';
    else if (style.includes('thin')) weight = '100';
    props.push({ prop: 'font-weight', value: weight });
    if (style.includes('italic')) props.push({ prop: 'font-style', value: 'italic' });
  }

  if (node.fontSize !== figma.mixed) {
    const raw = `${node.fontSize}px`;
    const varName = bv.fontSize ? await resolveVarName(bv.fontSize.id) : null;
    props.push({ prop: 'font-size', value: withVar(varName, raw) });
  }

  if (node.lineHeight !== figma.mixed && node.lineHeight.unit !== 'AUTO') {
    const lh = node.lineHeight;
    const raw = lh.unit === 'PIXELS' ? `${lh.value}px` : `${lh.value}%`;
    const varName = bv.lineHeight ? await resolveVarName(bv.lineHeight.id) : null;
    props.push({ prop: 'line-height', value: withVar(varName, raw) });
  }

  if (node.letterSpacing !== figma.mixed) {
    const ls = node.letterSpacing;
    if (ls.value !== 0) {
      const raw = ls.unit === 'PIXELS' ? `${ls.value}px` : `${(ls.value / 100).toFixed(2)}em`;
      const varName = bv.letterSpacing ? await resolveVarName(bv.letterSpacing.id) : null;
      props.push({ prop: 'letter-spacing', value: withVar(varName, raw) });
    }
  }

  if (node.textAlignHorizontal && node.textAlignHorizontal !== 'LEFT') {
    props.push({ prop: 'text-align', value: node.textAlignHorizontal.toLowerCase() });
  }

  // Text color from fills
  if (Array.isArray(node.fills)) {
    const fills = node.fills as Paint[];
    for (let i = 0; i < fills.length; i++) {
      const str = paintToStr(fills[i]);
      if (str) {
        const fillVarId = bv.fills?.[i]?.id;
        const fillVarName = fillVarId ? await resolveVarName(fillVarId) : null;
        props.push({ prop: 'color', value: withVar(fillVarName, str) });
        break;
      }
    }
  }

  return props;
}

// ── Instance reference extraction ────────────────────────

// Treat INSTANCE nodes as opaque references: emit the source component name
// + the instance's componentProperties (variant selection, booleans, etc.)
// so consumers can cross-link to the separately-extracted source instead of
// re-reading inflated children.
async function getInstanceProps(node: InstanceNode): Promise<PropEntry[]> {
  const props: PropEntry[] = [];

  let ref = 'unknown';
  try {
    const main = await node.getMainComponentAsync();
    if (main) {
      ref = main.parent?.type === 'COMPONENT_SET' ? main.parent.name : main.name;
    }
  } catch { /* ignore — fall back to 'unknown' */ }
  props.push({ prop: 'instance', value: ref });

  // Disambiguate name collisions when stripping Figma's #nodeId:offset suffix
  // produces duplicate clean names (e.g., 4 INSTANCE_SWAP props all named "Cells").
  const entries = Object.entries(node.componentProperties);
  const cleaned = entries.map(([name]) => name.replace(/#\d+:\d+$/, ''));
  const counts = new Map<string, number>();
  for (const c of cleaned) counts.set(c, (counts.get(c) ?? 0) + 1);
  const seen = new Map<string, number>();

  for (let i = 0; i < entries.length; i++) {
    const def = entries[i][1];
    // Skip props with no surfaced value (Figma sometimes returns undefined for
    // unset INSTANCE_SWAP defaults; the slot list lives in the source component spec).
    if (def.value === undefined || def.value === null) continue;

    const clean = cleaned[i];
    const total = counts.get(clean)!;
    let label: string;
    if (total > 1) {
      const idx = (seen.get(clean) ?? 0) + 1;
      seen.set(clean, idx);
      label = `.${clean}#${idx}`;
    } else {
      label = `.${clean}`;
    }

    let value: string;
    if (typeof def.value === 'boolean') value = String(def.value);
    else if (typeof def.value === 'symbol') value = '(mixed)';
    else value = String(def.value);
    props.push({ prop: label, value });
  }

  return props;
}

// ── Component properties ─────────────────────────────────

function getComponentProps(node: ComponentSetNode | ComponentNode): string[] {
  const lines: string[] = [];

  if (node.type === 'COMPONENT_SET') {
    const defs = node.componentPropertyDefinitions;
    for (const [name, def] of Object.entries(defs)) {
      if (def.type === 'VARIANT') {
        lines.push(`${name}: ${(def.variantOptions || []).join(' | ')}`);
      } else if (def.type === 'BOOLEAN') {
        lines.push(`${name}: boolean`);
      } else if (def.type === 'TEXT') {
        lines.push(`${name}: text`);
      } else if (def.type === 'INSTANCE_SWAP') {
        lines.push(`${name}: instance-swap`);
      }
    }
  } else if (node.type === 'COMPONENT') {
    const defs = node.componentPropertyDefinitions;
    for (const [name, def] of Object.entries(defs)) {
      if (def.type === 'BOOLEAN') {
        lines.push(`${name}: boolean (default: ${def.defaultValue})`);
      } else if (def.type === 'TEXT') {
        lines.push(`${name}: text (default: "${def.defaultValue}")`);
      } else if (def.type === 'INSTANCE_SWAP') {
        lines.push(`${name}: instance-swap`);
      }
    }
  }

  return lines;
}

// ── Structured node property collection ──────────────────

// Paths are relative to the root node so sibling variants align for diffing.
// Root collects to '' (rendered as '(root)'). Siblings sharing a name get
// uniform #1..#N suffixes (only when there's more than one) so collapse can
// pattern-match cleanly downstream.
async function collectNodeProps(
  root: SceneNode
): Promise<Map<string, PropEntry[]>> {
  const result = new Map<string, PropEntry[]>();

  async function walk(node: SceneNode, path: string) {
    const props: PropEntry[] = [
      ...(node.type === 'INSTANCE' ? await getInstanceProps(node as InstanceNode) : []),
      ...await getSizeProps(node),
      ...await getLayoutProps(node),
      ...await getAppearanceProps(node),
      ...(node.type === 'TEXT' ? await getTextProps(node as TextNode) : []),
    ];
    result.set(path, props);

    // Instances are opaque — don't traverse their inflated children.
    if (node.type !== 'INSTANCE' && 'children' in node) {
      const children = (node as ChildrenMixin).children;
      const counts = new Map<string, number>();
      for (const c of children) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
      const assigned = new Map<string, number>();
      for (const child of children) {
        const total = counts.get(child.name)!;
        const idx = (assigned.get(child.name) ?? 0) + 1;
        assigned.set(child.name, idx);
        const segment = total > 1 ? `${child.name}#${idx}` : child.name;
        const childPath = path ? `${path}/${segment}` : segment;
        await walk(child as SceneNode, childPath);
      }
    }
  }

  await walk(root, '');
  return result;
}

// ── Variant diffing ──────────────────────────────────────

function parseVariantName(name: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of name.split(',')) {
    const [key, val] = pair.split('=').map(s => s.trim());
    if (key && val) result[key] = val;
  }
  return result;
}

function diffProps(
  base: Map<string, PropEntry[]>,
  variant: Map<string, PropEntry[]>
): Map<string, PropEntry[]> {
  const changes = new Map<string, PropEntry[]>();

  for (const [path, vProps] of variant) {
    const bProps = base.get(path);
    if (!bProps) {
      changes.set(path, [{ prop: '[added]', value: '' }]);
      continue;
    }
    const bMap = new Map(bProps.map(p => [p.prop, p.value]));
    const diff = vProps.filter(p => bMap.get(p.prop) !== p.value);
    if (diff.length > 0) changes.set(path, diff);
  }

  // Detect removed nodes
  for (const path of base.keys()) {
    if (!variant.has(path)) {
      changes.set(path, [{ prop: '[removed]', value: '' }]);
    }
  }

  return changes;
}

function entriesEqual(a: PropEntry[], b: PropEntry[]): boolean {
  if (a.length !== b.length) return false;
  const aMap = new Map(a.map(p => [p.prop, p.value]));
  for (const p of b) {
    if (aMap.get(p.prop) !== p.value) return false;
  }
  return true;
}

// Collapse sibling instances that share identical deltas into a single entry
// keyed at the pattern path (with #N suffixes replaced by [*]). When deltas
// differ across siblings the original paths are preserved.
function collapseSiblingDeltas(
  changes: Map<string, PropEntry[]>
): Map<string, PropEntry[]> {
  const toPattern = (path: string) =>
    path.split('/').map(s => s.replace(/#\d+$/, '[*]')).join('/');

  const groups = new Map<string, { paths: string[]; entries: PropEntry[][] }>();
  for (const [path, entries] of changes) {
    const key = toPattern(path);
    let g = groups.get(key);
    if (!g) { g = { paths: [], entries: [] }; groups.set(key, g); }
    g.paths.push(path);
    g.entries.push(entries);
  }

  const result = new Map<string, PropEntry[]>();
  const handled = new Set<string>();

  for (const [origPath, origEntries] of changes) {
    if (handled.has(origPath)) continue;
    const key = toPattern(origPath);
    const g = groups.get(key)!;

    if (g.paths.length === 1) {
      result.set(origPath, origEntries);
      handled.add(origPath);
      continue;
    }

    const allMatch = g.entries.every(e => entriesEqual(e, g.entries[0]));
    if (allMatch) {
      result.set(key, g.entries[0]);
      for (const p of g.paths) handled.add(p);
    } else {
      for (let i = 0; i < g.paths.length; i++) {
        if (!handled.has(g.paths[i])) {
          result.set(g.paths[i], g.entries[i]);
          handled.add(g.paths[i]);
        }
      }
    }
  }

  return result;
}

// ── Tree walk → plain text ───────────────────────────────

async function nodeToText(node: SceneNode, depth: number): Promise<string> {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  lines.push(`${indent}${node.name}`);

  const allProps: PropEntry[] = [
    ...(node.type === 'INSTANCE' ? await getInstanceProps(node as InstanceNode) : []),
    ...await getSizeProps(node),
    ...await getLayoutProps(node),
    ...await getAppearanceProps(node),
    ...(node.type === 'TEXT' ? await getTextProps(node as TextNode) : []),
  ];

  for (const p of allProps) {
    lines.push(`${indent}  ${p.prop}: ${p.value}`);
  }

  // Instances are opaque references — skip inflated children in the readable tree too.
  if (node.type !== 'INSTANCE' && 'children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      lines.push('');
      lines.push(await nodeToText(child as SceneNode, depth + 1));
    }
  }

  return lines.join('\n');
}

// ── Selection listener ──────────────────────────────────

function getSelectionInfo(): SelectionInfo | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0];

  let childCount = 0;
  let variantCount: number | null = null;

  if ('children' in node) {
    childCount = (node as ChildrenMixin).children.length;
  }

  if (node.type === 'COMPONENT_SET') {
    variantCount = (node as ComponentSetNode).children.filter(c => c.type === 'COMPONENT').length;
  }

  return {
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height),
    childCount,
    variantCount,
  };
}

function pushSelection() {
  const msg: CodeMessage = { type: 'selection-changed', info: getSelectionInfo() };
  figma.ui.postMessage(msg);
}

figma.on('selectionchange', pushSelection);

// ── Export handler ───────────────────────────────────────

// ── Format helpers for variant diff output ───────────────

function formatDiffSection(changes: Map<string, PropEntry[]>): string[] {
  const lines: string[] = [];
  for (const [path, entries] of changes) {
    const label = path || '(root)';
    const parts = entries.map(e =>
      e.prop === '[added]' ? '[added]'
      : e.prop === '[removed]' ? '[removed]'
      : `${e.prop} → ${e.value}`
    );
    lines.push(`  ${label}: ${parts.join(', ')}`);
  }
  return lines;
}

async function handleExport() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    figma.ui.postMessage({ type: 'error', message: 'Select exactly one node to export.' } as CodeMessage);
    return;
  }

  const node = sel[0];
  try {
    // Clear variable cache for fresh resolution each export
    varCache.clear();

    figma.ui.postMessage({ type: 'export-progress', message: 'Extracting properties...', percent: 10 } as CodeMessage);

    const out: string[] = [];

    // Header
    out.push(node.name);
    const typeLabel = node.type.replace(/_/g, ' ');
    if (node.type === 'COMPONENT_SET') {
      out.push(typeLabel);
    } else {
      out.push(`${typeLabel} | ${Math.round(node.width)} x ${Math.round(node.height)}`);
    }

    // Component properties
    if (node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
      const propLines = getComponentProps(node as any);
      if (propLines.length > 0) {
        out.push('');
        out.push('Properties:');
        for (const l of propLines) out.push(`  ${l}`);
      }
      if (node.type === 'COMPONENT_SET') {
        const count = (node as ComponentSetNode).children.filter(c => c.type === 'COMPONENT').length;
        out.push(`  Variants: ${count}`);
      }
    }

    out.push('');
    out.push('---');
    out.push('');

    // ── Component Set: variant diffing pipeline ──────────
    if (node.type === 'COMPONENT_SET') {
      const csNode = node as ComponentSetNode;
      const allVariants = csNode.children.filter(c => c.type === 'COMPONENT') as ComponentNode[];
      if (allVariants.length === 0) {
        out.push('(no variants found)');
      } else {
        // Pick the first variant as base
        const baseVariant = allVariants[0];
        const baseParsed = parseVariantName(baseVariant.name);

        figma.ui.postMessage({ type: 'export-progress', message: 'Resolving base variant...', percent: 20 } as CodeMessage);

        // Base variant label
        out.push(`Base: ${baseVariant.name}`);
        out.push('');

        // Full base tree with tokens
        out.push(await nodeToText(baseVariant, 0));

        figma.ui.postMessage({ type: 'export-progress', message: 'Collecting base properties...', percent: 30 } as CodeMessage);

        // Collect structured base props for diffing
        const baseProps = await collectNodeProps(baseVariant);

        // ── Dimension isolation ──────────────────────
        // Get variant property definitions (only VARIANT type)
        const defs = csNode.componentPropertyDefinitions;
        const dimensions: { name: string; values: string[] }[] = [];
        for (const [name, def] of Object.entries(defs)) {
          if (def.type === 'VARIANT' && def.variantOptions) {
            dimensions.push({ name, values: def.variantOptions });
          }
        }

        // For each dimension, find variants that differ from base in ONLY that dimension
        const diffSections: string[] = [];
        const totalDimValues = dimensions.reduce((sum, d) => sum + d.values.length - 1, 0);
        let processedValues = 0;

        for (const dim of dimensions) {
          const baseVal = baseParsed[dim.name];
          const otherValues = dim.values.filter(v => v !== baseVal);

          for (const targetVal of otherValues) {
            // Build the target variant key: same as base but with this one dimension changed
            const targetParsed = { ...baseParsed, [dim.name]: targetVal };

            // Find matching variant
            const targetVariant = allVariants.find(v => {
              const parsed = parseVariantName(v.name);
              return Object.entries(targetParsed).every(([k, val]) => parsed[k] === val);
            });

            processedValues++;
            const percent = 40 + Math.round((processedValues / Math.max(totalDimValues, 1)) * 50);
            figma.ui.postMessage({ type: 'export-progress', message: `Diffing ${dim.name}=${targetVal}...`, percent } as CodeMessage);

            if (!targetVariant) continue;

            const variantProps = await collectNodeProps(targetVariant);
            const changes = collapseSiblingDeltas(diffProps(baseProps, variantProps));

            if (changes.size > 0) {
              diffSections.push(`${dim.name}=${targetVal}:`);
              diffSections.push(...formatDiffSection(changes));
            }
          }
        }

        if (diffSections.length > 0) {
          out.push('');
          out.push('---');
          out.push('');
          out.push('Variant changes:');
          out.push('');
          out.push(...diffSections);
        }
      }

    // ── Non-component-set: plain tree walk ───────────────
    } else {
      figma.ui.postMessage({ type: 'export-progress', message: 'Building layer tree...', percent: 60 } as CodeMessage);
      out.push(await nodeToText(node, 0));
    }

    figma.ui.postMessage({ type: 'export-progress', message: 'Done', percent: 100 } as CodeMessage);

    const text = out.join('\n');
    figma.ui.postMessage({ type: 'export-complete', text } as CodeMessage);
    figma.notify(`Exported "${node.name}" (${(text.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: `Export failed: ${err}` } as CodeMessage);
  }
}

// ── Import handler ──────────────────────────────────────

async function handleImport(snapshot: any, componentName: string) {
  try {
    const result = await reconstructFromSnapshot(snapshot, {
      componentName,
      onProgress: (message, percent) => {
        figma.ui.postMessage({ type: 'import-progress', message, percent } as CodeMessage);
      },
    });

    figma.ui.postMessage({ type: 'import-complete', nodeId: result.nodeId, warnings: result.warnings } as CodeMessage);
    const warnCount = result.warnings.length;
    figma.notify(
      warnCount > 0
        ? `Reconstructed "${componentName}" with ${warnCount} warning${warnCount === 1 ? '' : 's'}`
        : `Reconstructed "${componentName}"`,
    );
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: `Import failed: ${err}` } as CodeMessage);
  }
}

// ── Message handler ─────────────────────────────────────

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'export':
      await handleExport();
      break;
    case 'import':
      await handleImport(msg.snapshot, msg.componentName);
      break;
    case 'resize':
      figma.ui.resize(420, msg.height);
      break;
  }
};

pushSelection();
