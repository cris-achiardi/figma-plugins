import { UIMessage, CodeMessage, SelectionInfo } from './types';
import { reconstructFromSnapshot } from './reconstruct';

figma.showUI(__html__, { width: 420, height: 520 });

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

function getSizeProps(node: SceneNode): string[] {
  const props: string[] = [];
  const n = node as any;

  if (n.layoutSizingHorizontal === 'HUG') props.push('width: hug');
  else if (n.layoutSizingHorizontal === 'FILL') props.push('width: fill');
  else props.push(`width: ${Math.round(node.width)}px`);

  if (n.layoutSizingVertical === 'HUG') props.push('height: hug');
  else if (n.layoutSizingVertical === 'FILL') props.push('height: fill');
  else props.push(`height: ${Math.round(node.height)}px`);

  return props;
}

function getLayoutProps(node: SceneNode): string[] {
  const props: string[] = [];
  if (!('layoutMode' in node)) return props;
  const f = node as FrameNode;
  if (f.layoutMode === 'NONE') return props;

  if (f.layoutMode === 'HORIZONTAL') {
    props.push('display: flex');
  } else {
    props.push('display: flex');
    props.push('flex-direction: column');
  }

  if (f.layoutWrap === 'WRAP') props.push('flex-wrap: wrap');

  const justify: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between',
  };
  if (justify[f.primaryAxisAlignItems]) {
    props.push(`justify-content: ${justify[f.primaryAxisAlignItems]}`);
  }

  const align: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline',
  };
  if (align[f.counterAxisAlignItems]) {
    props.push(`align-items: ${align[f.counterAxisAlignItems]}`);
  }

  if (f.itemSpacing > 0) props.push(`gap: ${f.itemSpacing}px`);

  const pt = f.paddingTop || 0, pr = f.paddingRight || 0;
  const pb = f.paddingBottom || 0, pl = f.paddingLeft || 0;
  if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
    props.push(`padding: ${formatPadding(pt, pr, pb, pl)}`);
  }

  return props;
}

function getAppearanceProps(node: SceneNode): string[] {
  const props: string[] = [];

  // Corner radius
  if ('cornerRadius' in node) {
    const r = (node as any).cornerRadius;
    if (r === figma.mixed) {
      const n = node as FrameNode;
      props.push(`border-radius: ${n.topLeftRadius}px ${n.topRightRadius}px ${n.bottomRightRadius}px ${n.bottomLeftRadius}px`);
    } else if (typeof r === 'number' && r > 0) {
      props.push(`border-radius: ${r}px`);
    }
  }

  // Strokes → border
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes;
    if (Array.isArray(strokes)) {
      for (const s of strokes) {
        if (s.visible === false) continue;
        if (s.type === 'SOLID') {
          const hex = rgbToHex(s.color.r, s.color.g, s.color.b);
          const w = (node as GeometryMixin).strokeWeight;
          props.push(`border: ${typeof w === 'number' ? w : 1}px solid ${hex}`);
          break;
        }
      }
    }
  }

  // Fills → background (skip text nodes, they use color instead)
  if ('fills' in node && node.type !== 'TEXT') {
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills)) {
      for (const f of fills) {
        const str = paintToStr(f);
        if (str) { props.push(`background: ${str}`); break; }
      }
    }
  }

  // Opacity
  if ('opacity' in node && (node as any).opacity < 1) {
    props.push(`opacity: ${Math.round((node as any).opacity * 100)}%`);
  }

  // Effects
  if ('effects' in node) {
    for (const fx of (node as BlendMixin).effects) {
      if (!fx.visible) continue;
      if (fx.type === 'DROP_SHADOW') {
        const hex = rgbToHex(fx.color.r, fx.color.g, fx.color.b);
        props.push(`box-shadow: ${fx.offset.x}px ${fx.offset.y}px ${fx.radius}px ${hex}`);
      } else if (fx.type === 'INNER_SHADOW') {
        const hex = rgbToHex(fx.color.r, fx.color.g, fx.color.b);
        props.push(`box-shadow: inset ${fx.offset.x}px ${fx.offset.y}px ${fx.radius}px ${hex}`);
      } else if (fx.type === 'LAYER_BLUR') {
        props.push(`filter: blur(${fx.radius}px)`);
      } else if (fx.type === 'BACKGROUND_BLUR') {
        props.push(`backdrop-filter: blur(${fx.radius}px)`);
      }
    }
  }

  return props;
}

function getTextProps(node: TextNode): string[] {
  const props: string[] = [];

  if (node.fontName !== figma.mixed) {
    props.push(`font-family: ${node.fontName.family}`);
    const style = node.fontName.style.toLowerCase();
    let weight = '400';
    if (style.includes('black')) weight = '900';
    else if (style.includes('extrabold')) weight = '800';
    else if (style.includes('bold')) weight = '700';
    else if (style.includes('semibold')) weight = '600';
    else if (style.includes('medium')) weight = '500';
    else if (style.includes('light')) weight = '300';
    else if (style.includes('thin')) weight = '100';
    props.push(`font-weight: ${weight}`);
    if (style.includes('italic')) props.push('font-style: italic');
  }

  if (node.fontSize !== figma.mixed) {
    props.push(`font-size: ${node.fontSize}px`);
  }

  if (node.lineHeight !== figma.mixed && node.lineHeight.unit !== 'AUTO') {
    const lh = node.lineHeight;
    props.push(`line-height: ${lh.unit === 'PIXELS' ? `${lh.value}px` : `${lh.value}%`}`);
  }

  if (node.letterSpacing !== figma.mixed) {
    const ls = node.letterSpacing;
    if (ls.value !== 0) {
      props.push(`letter-spacing: ${ls.unit === 'PIXELS' ? `${ls.value}px` : `${(ls.value / 100).toFixed(2)}em`}`);
    }
  }

  if (node.textAlignHorizontal && node.textAlignHorizontal !== 'LEFT') {
    props.push(`text-align: ${node.textAlignHorizontal.toLowerCase()}`);
  }

  // Text color from fills
  if (Array.isArray(node.fills)) {
    for (const f of node.fills as Paint[]) {
      const str = paintToStr(f);
      if (str) { props.push(`color: ${str}`); break; }
    }
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

// ── Tree walk → plain text ───────────────────────────────

function nodeToText(node: SceneNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  lines.push(`${indent}${node.name}`);

  const allProps: string[] = [
    ...getSizeProps(node),
    ...getLayoutProps(node),
    ...getAppearanceProps(node),
    ...(node.type === 'TEXT' ? getTextProps(node as TextNode) : []),
  ];

  for (const p of allProps) {
    lines.push(`${indent}  ${p}`);
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      lines.push('');
      lines.push(nodeToText(child as SceneNode, depth + 1));
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

async function handleExport() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    figma.ui.postMessage({ type: 'error', message: 'Select exactly one node to export.' } as CodeMessage);
    return;
  }

  const node = sel[0];
  try {
    figma.ui.postMessage({ type: 'export-progress', message: 'Extracting properties...', percent: 30 } as CodeMessage);

    const out: string[] = [];

    // Header
    out.push(node.name);
    out.push(`${node.type.replace(/_/g, ' ')} | ${Math.round(node.width)} x ${Math.round(node.height)}`);

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

    figma.ui.postMessage({ type: 'export-progress', message: 'Building layer tree...', percent: 60 } as CodeMessage);

    // For component sets, walk the first variant
    let target: SceneNode = node;
    if (node.type === 'COMPONENT_SET') {
      const variants = (node as ComponentSetNode).children;
      if (variants.length > 0) {
        target = variants[0] as SceneNode;
        out.push(`Variant: ${target.name}`);
        out.push('');
      }
    }

    out.push(nodeToText(target, 0));

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
