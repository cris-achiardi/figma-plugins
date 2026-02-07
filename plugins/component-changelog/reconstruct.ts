// Reconstruction engine — rebuilds Figma nodes from JSON_REST_V1 snapshots

let nodeCount = 0;

// ── Entry point ──────────────────────────────────────

export async function reconstructFromSnapshot(
  snapshot: any,
  options: {
    componentName?: string;
    onProgress: (message: string, percent: number) => void;
  }
): Promise<{ nodeId: string; warnings: string[] }> {
  const warnings: string[] = [];
  const fontCache = new Set<string>();
  nodeCount = 0;

  const doc = snapshot?.document;
  if (!doc) throw new Error('Snapshot has no document property');

  options.onProgress('Preparing reconstruction...', 5);

  // Create a new node on the current page
  const root = await createNodeFromSnapshot(doc, figma.currentPage, null, warnings, fontCache, options.onProgress);
  if (!root) throw new Error('Failed to create root node from snapshot');

  root.name = `${options.componentName || doc.name || 'Component'} (restored)`;

  // Position near viewport center
  const vp = figma.viewport.center;
  root.x = Math.round(vp.x - root.width / 2);
  root.y = Math.round(vp.y - root.height / 2);

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);

  options.onProgress('Reconstruction complete!', 100);
  return { nodeId: root.id, warnings };
}

// ── Node creation dispatcher ─────────────────────────

async function createNodeFromSnapshot(
  snapNode: any,
  parent: BaseNode & ChildrenMixin,
  parentSnap: any,
  warnings: string[],
  fontCache: Set<string>,
  onProgress: (message: string, percent: number) => void,
): Promise<SceneNode | null> {
  if (!snapNode || !snapNode.type) return null;

  // Yield every 10 nodes to keep UI responsive
  nodeCount++;
  if (nodeCount % 10 === 0) {
    await new Promise(r => setTimeout(r, 0));
  }

  const type = snapNode.type as string;

  switch (type) {
    case 'FRAME':
      return await buildFrame(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
    case 'RECTANGLE':
      return buildRectangle(snapNode, parent, parentSnap, warnings);
    case 'ELLIPSE':
      return buildEllipse(snapNode, parent, parentSnap, warnings);
    case 'TEXT':
      return await buildText(snapNode, parent, parentSnap, warnings, fontCache);
    case 'GROUP':
      return await buildGroup(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
    case 'COMPONENT':
      return await buildComponent(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
    case 'COMPONENT_SET':
      return await buildComponentSet(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
    case 'INSTANCE':
      warnings.push(`"${snapNode.name || 'Instance'}": INSTANCE downgraded to Frame (cannot recreate without original component)`);
      return await buildFrame(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
    case 'VECTOR':
    case 'STAR':
    case 'REGULAR_POLYGON':
    case 'LINE':
    case 'BOOLEAN_OPERATION':
      if (snapNode._svgData) {
        return buildFromSvg(snapNode, parent, parentSnap, warnings);
      }
      if (type === 'BOOLEAN_OPERATION') {
        warnings.push(`"${snapNode.name || 'BooleanOp'}": BOOLEAN_OPERATION downgraded to Frame (no SVG data)`);
        return await buildFrame(snapNode, parent, parentSnap, warnings, fontCache, onProgress);
      }
      warnings.push(`"${snapNode.name || type}": ${type} replaced with placeholder rectangle (no SVG data)`);
      return buildVectorPlaceholder(snapNode, parent, parentSnap, warnings);
    default:
      warnings.push(`Unknown node type "${type}" for "${snapNode.name || '?'}" — skipped`);
      return null;
  }
}

// ── Node builders ────────────────────────────────────

async function buildFrame(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[], fontCache: Set<string>,
  onProgress: (message: string, percent: number) => void,
): Promise<FrameNode> {
  const frame = figma.createFrame();
  parent.appendChild(frame);
  applyCommonProperties(frame, snap);
  applyFrameProperties(frame, snap);
  applyChildLayoutProperties(frame, snap, parentSnap);

  if (snap.children && Array.isArray(snap.children)) {
    for (const child of snap.children) {
      await createNodeFromSnapshot(child, frame, snap, warnings, fontCache, onProgress);
    }
  }

  return frame;
}

function buildRectangle(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[],
): RectangleNode {
  const rect = figma.createRectangle();
  parent.appendChild(rect);
  applyCommonProperties(rect, snap);
  applyCornerRadius(rect, snap);
  applyChildLayoutProperties(rect, snap, parentSnap);
  return rect;
}

function buildEllipse(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[],
): EllipseNode {
  const ellipse = figma.createEllipse();
  parent.appendChild(ellipse);
  applyCommonProperties(ellipse, snap);
  applyChildLayoutProperties(ellipse, snap, parentSnap);
  return ellipse;
}

async function buildText(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[], fontCache: Set<string>,
): Promise<TextNode> {
  const text = figma.createText();
  parent.appendChild(text);

  // Load font before setting characters
  await loadFont(snap, fontCache, warnings);

  applyCommonProperties(text, snap);
  applyTextProperties(text, snap, warnings);
  applyChildLayoutProperties(text, snap, parentSnap);
  return text;
}

async function buildGroup(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[], fontCache: Set<string>,
  onProgress: (message: string, percent: number) => void,
): Promise<SceneNode | null> {
  // Groups require at least one child — build children first into a temp frame
  if (!snap.children || snap.children.length === 0) {
    warnings.push(`"${snap.name || 'Group'}": empty group skipped`);
    return null;
  }

  const children: SceneNode[] = [];
  for (const childSnap of snap.children) {
    const child = await createNodeFromSnapshot(childSnap, parent, snap, warnings, fontCache, onProgress);
    if (child) children.push(child);
  }

  if (children.length === 0) {
    warnings.push(`"${snap.name || 'Group'}": no valid children, group skipped`);
    return null;
  }

  const group = figma.group(children, parent);
  group.name = snap.name || 'Group';
  if (snap.visible === false) group.visible = false;
  if (typeof snap.opacity === 'number') group.opacity = snap.opacity;

  return group;
}

async function buildComponent(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[], fontCache: Set<string>,
  onProgress: (message: string, percent: number) => void,
): Promise<ComponentNode> {
  const comp = figma.createComponent();
  parent.appendChild(comp);
  applyCommonProperties(comp, snap);
  applyFrameProperties(comp, snap);
  applyChildLayoutProperties(comp, snap, parentSnap);

  if (snap.children && Array.isArray(snap.children)) {
    for (const child of snap.children) {
      await createNodeFromSnapshot(child, comp, snap, warnings, fontCache, onProgress);
    }
  }

  return comp;
}

async function buildComponentSet(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[], fontCache: Set<string>,
  onProgress: (message: string, percent: number) => void,
): Promise<SceneNode> {
  // Build child Components first, then combine as variants
  if (!snap.children || snap.children.length === 0) {
    // No variants — just create a frame placeholder
    warnings.push(`"${snap.name || 'ComponentSet'}": no variants, created as frame`);
    return await buildFrame(snap, parent, parentSnap, warnings, fontCache, onProgress);
  }

  const childEntries: { comp: ComponentNode; childSnap: any }[] = [];
  for (const childSnap of snap.children) {
    if (childSnap.type === 'COMPONENT') {
      const comp = await buildComponent(childSnap, parent, null, warnings, fontCache, onProgress);
      childEntries.push({ comp, childSnap });
    } else {
      // Non-component children in a component set — unusual, build as frame
      await createNodeFromSnapshot(childSnap, parent, snap, warnings, fontCache, onProgress);
    }
  }

  if (childEntries.length < 2) {
    // combineAsVariants requires 2+ components; if only 1, just name it and return
    if (childEntries.length === 1) {
      childEntries[0].comp.name = snap.name || childEntries[0].comp.name;
      return childEntries[0].comp;
    }
    warnings.push(`"${snap.name || 'ComponentSet'}": no component children, created as frame`);
    return await buildFrame(snap, parent, parentSnap, warnings, fontCache, onProgress);
  }

  const childComponents = childEntries.map(e => e.comp);
  const componentSet = figma.combineAsVariants(childComponents, parent as FrameNode | PageNode);

  // Only apply visual properties — do NOT resize or overwrite auto-layout
  applyVisualOnlyProperties(componentSet, snap);
  applyCornerRadius(componentSet, snap);

  // Position variants using original snapshot coordinates
  const SET_PADDING = 16;
  const parentBB = snap.absoluteBoundingBox;
  const hasCoords = parentBB && childEntries.every(e => e.childSnap.absoluteBoundingBox);

  if (hasCoords) {
    // Compute relative positions from parent bounding box
    const positions = childEntries.map(({ childSnap: cs }) => ({
      x: (cs.absoluteBoundingBox.x ?? 0) - (parentBB.x ?? 0),
      y: (cs.absoluteBoundingBox.y ?? 0) - (parentBB.y ?? 0),
    }));

    // Normalize so top-left variant starts at (padding, padding)
    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));

    // Disable auto-layout so manual positioning works
    try { (componentSet as any).layoutMode = 'NONE'; } catch { /* */ }

    let maxRight = 0;
    let maxBottom = 0;
    for (let i = 0; i < childEntries.length; i++) {
      const comp = childEntries[i].comp;
      comp.x = SET_PADDING + positions[i].x - minX;
      comp.y = SET_PADDING + positions[i].y - minY;
      maxRight = Math.max(maxRight, comp.x + comp.width);
      maxBottom = Math.max(maxBottom, comp.y + comp.height);
    }

    componentSet.resize(
      Math.max(1, maxRight + SET_PADDING),
      Math.max(1, maxBottom + SET_PADDING),
    );
  } else {
    // No coordinate data — fall back to auto-layout
    try {
      if (!componentSet.layoutMode || componentSet.layoutMode === 'NONE') {
        componentSet.layoutMode = 'HORIZONTAL';
      }
      componentSet.primaryAxisSizingMode = 'AUTO';
      componentSet.counterAxisSizingMode = 'AUTO';
      componentSet.paddingTop = SET_PADDING;
      componentSet.paddingBottom = SET_PADDING;
      componentSet.paddingLeft = SET_PADDING;
      componentSet.paddingRight = SET_PADDING;
      if (typeof snap.itemSpacing === 'number') {
        componentSet.itemSpacing = snap.itemSpacing;
      } else if (componentSet.itemSpacing === 0) {
        componentSet.itemSpacing = 20;
      }
    } catch { /* */ }
  }

  return componentSet;
}

function buildVectorPlaceholder(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[],
): RectangleNode {
  const rect = figma.createRectangle();
  parent.appendChild(rect);
  applyCommonProperties(rect, snap);
  applyCornerRadius(rect, snap);
  applyChildLayoutProperties(rect, snap, parentSnap);
  return rect;
}

function buildFromSvg(
  snap: any, parent: BaseNode & ChildrenMixin, parentSnap: any,
  warnings: string[],
): SceneNode {
  const svgFrame = figma.createNodeFromSvg(snap._svgData);

  // Flatten: if the SVG wrapper has exactly one child, extract it
  let result: SceneNode;
  if (svgFrame.children.length === 1) {
    const inner = svgFrame.children[0];
    parent.appendChild(inner);
    svgFrame.remove();
    result = inner;
  } else {
    parent.appendChild(svgFrame);
    result = svgFrame;
  }

  // Apply name from snapshot
  result.name = snap.name || result.name;

  // Apply size from snapshot bounding box
  if (snap.absoluteBoundingBox && 'resize' in result) {
    const bb = snap.absoluteBoundingBox;
    if (typeof bb.width === 'number' && typeof bb.height === 'number') {
      (result as any).resize(Math.max(1, bb.width), Math.max(1, bb.height));
    }
  }

  // Apply visibility and opacity
  if (snap.visible === false) result.visible = false;
  if (typeof snap.opacity === 'number') result.opacity = snap.opacity;

  applyChildLayoutProperties(result, snap, parentSnap);

  warnings.push(`"${snap.name || snap.type}": reconstructed from SVG`);
  return result;
}

// ── Property application helpers ─────────────────────

function applyVisualOnlyProperties(node: SceneNode, snap: any) {
  // Visual properties only — no resize, no layout. Used after combineAsVariants.
  if (snap.name) node.name = snap.name;
  if (snap.visible === false) node.visible = false;
  if (typeof snap.opacity === 'number') node.opacity = snap.opacity;
  if (snap.blendMode && snap.blendMode !== 'PASS_THROUGH') {
    try { node.blendMode = snap.blendMode; } catch { /* unsupported blend mode */ }
  }
  if (typeof snap.clipsContent === 'boolean' && 'clipsContent' in node) {
    (node as FrameNode).clipsContent = snap.clipsContent;
  }

  // Fills
  if (snap.fills && Array.isArray(snap.fills) && 'fills' in node) {
    const paints = convertPaints(snap.fills);
    if (paints.length > 0) {
      (node as GeometryMixin).fills = paints;
    }
  }

  // Strokes
  if (snap.strokes && Array.isArray(snap.strokes) && 'strokes' in node) {
    const paints = convertPaints(snap.strokes);
    if (paints.length > 0) {
      (node as GeometryMixin).strokes = paints;
    }
  }
  if (typeof snap.strokeWeight === 'number' && 'strokeWeight' in node) {
    (node as GeometryMixin).strokeWeight = snap.strokeWeight;
  }
  if (snap.strokeAlign && 'strokeAlign' in node) {
    const align = snap.strokeAlign as string;
    if (['INSIDE', 'OUTSIDE', 'CENTER'].includes(align)) {
      (node as GeometryMixin).strokeAlign = align as 'INSIDE' | 'OUTSIDE' | 'CENTER';
    }
  }

  // Effects
  if (snap.effects && Array.isArray(snap.effects) && 'effects' in node) {
    const effects = convertEffects(snap.effects);
    if (effects.length > 0) {
      (node as BlendMixin).effects = effects;
    }
  }
}

function applyCommonProperties(node: SceneNode, snap: any) {
  if (snap.name) node.name = snap.name;
  if (snap.visible === false) node.visible = false;
  if (typeof snap.opacity === 'number') node.opacity = snap.opacity;
  if (snap.blendMode && snap.blendMode !== 'PASS_THROUGH') {
    try { node.blendMode = snap.blendMode; } catch { /* unsupported blend mode */ }
  }

  // Size from absoluteBoundingBox
  if (snap.absoluteBoundingBox) {
    const bb = snap.absoluteBoundingBox;
    if ('resize' in node && typeof bb.width === 'number' && typeof bb.height === 'number') {
      (node as any).resize(Math.max(1, bb.width), Math.max(1, bb.height));
    }
  } else if (snap.size) {
    if ('resize' in node) {
      (node as any).resize(Math.max(1, snap.size.x || 1), Math.max(1, snap.size.y || 1));
    }
  }

  // Fills
  if (snap.fills && Array.isArray(snap.fills) && 'fills' in node) {
    const paints = convertPaints(snap.fills);
    if (paints.length > 0) {
      (node as GeometryMixin).fills = paints;
    }
  }

  // Strokes
  if (snap.strokes && Array.isArray(snap.strokes) && 'strokes' in node) {
    const paints = convertPaints(snap.strokes);
    if (paints.length > 0) {
      (node as GeometryMixin).strokes = paints;
    }
  }

  if (typeof snap.strokeWeight === 'number' && 'strokeWeight' in node) {
    (node as GeometryMixin).strokeWeight = snap.strokeWeight;
  }

  if (snap.strokeAlign && 'strokeAlign' in node) {
    const align = snap.strokeAlign as string;
    if (['INSIDE', 'OUTSIDE', 'CENTER'].includes(align)) {
      (node as GeometryMixin).strokeAlign = align as 'INSIDE' | 'OUTSIDE' | 'CENTER';
    }
  }

  // Effects
  if (snap.effects && Array.isArray(snap.effects) && 'effects' in node) {
    const effects = convertEffects(snap.effects);
    if (effects.length > 0) {
      (node as BlendMixin).effects = effects;
    }
  }
}

function applyFrameProperties(frame: FrameNode | ComponentNode | ComponentSetNode, snap: any) {
  if (typeof snap.clipsContent === 'boolean') {
    frame.clipsContent = snap.clipsContent;
  }

  // Layout mode MUST be set before padding/spacing
  if (snap.layoutMode && snap.layoutMode !== 'NONE') {
    frame.layoutMode = snap.layoutMode as 'HORIZONTAL' | 'VERTICAL';

    // Padding
    if (typeof snap.paddingTop === 'number') frame.paddingTop = snap.paddingTop;
    if (typeof snap.paddingBottom === 'number') frame.paddingBottom = snap.paddingBottom;
    if (typeof snap.paddingLeft === 'number') frame.paddingLeft = snap.paddingLeft;
    if (typeof snap.paddingRight === 'number') frame.paddingRight = snap.paddingRight;

    // Spacing
    if (typeof snap.itemSpacing === 'number') frame.itemSpacing = snap.itemSpacing;
    if (typeof snap.counterAxisSpacing === 'number') frame.counterAxisSpacing = snap.counterAxisSpacing;

    // Sizing modes
    if (snap.primaryAxisSizingMode) {
      frame.primaryAxisSizingMode = snap.primaryAxisSizingMode as 'FIXED' | 'AUTO';
    }
    if (snap.counterAxisSizingMode) {
      frame.counterAxisSizingMode = snap.counterAxisSizingMode as 'FIXED' | 'AUTO';
    }

    // Alignment
    if (snap.primaryAxisAlignItems) {
      frame.primaryAxisAlignItems = snap.primaryAxisAlignItems as 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    }
    if (snap.counterAxisAlignItems) {
      frame.counterAxisAlignItems = snap.counterAxisAlignItems as 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
    }
  }

  applyCornerRadius(frame, snap);
}

function applyCornerRadius(node: SceneNode, snap: any) {
  if (!('cornerRadius' in node)) return;

  const n = node as RectangleNode | FrameNode;
  if (typeof snap.cornerRadius === 'number') {
    n.cornerRadius = snap.cornerRadius;
  }
  // Individual corner radii
  if (typeof snap.topLeftRadius === 'number') n.topLeftRadius = snap.topLeftRadius;
  if (typeof snap.topRightRadius === 'number') n.topRightRadius = snap.topRightRadius;
  if (typeof snap.bottomLeftRadius === 'number') n.bottomLeftRadius = snap.bottomLeftRadius;
  if (typeof snap.bottomRightRadius === 'number') n.bottomRightRadius = snap.bottomRightRadius;
}

function applyChildLayoutProperties(node: SceneNode, snap: any, parentSnap: any) {
  // Position: compute from absoluteBoundingBox relative to parent
  if (parentSnap && snap.absoluteBoundingBox && parentSnap.absoluteBoundingBox) {
    // Only position non-auto-layout children
    if (!parentSnap.layoutMode || parentSnap.layoutMode === 'NONE') {
      const pos = computeRelativePosition(snap, parentSnap);
      node.x = pos.x;
      node.y = pos.y;
    }
  }

  // Auto-layout child properties
  if (parentSnap?.layoutMode && parentSnap.layoutMode !== 'NONE') {
    if ('layoutAlign' in node && snap.layoutAlign) {
      (node as any).layoutAlign = snap.layoutAlign;
    }
    if ('layoutGrow' in node && typeof snap.layoutGrow === 'number') {
      (node as any).layoutGrow = snap.layoutGrow;
    }
    // layoutSizingHorizontal / layoutSizingVertical from REST API
    if ('layoutSizingHorizontal' in node && snap.layoutSizingHorizontal) {
      try { (node as any).layoutSizingHorizontal = snap.layoutSizingHorizontal; } catch { /* */ }
    }
    if ('layoutSizingVertical' in node && snap.layoutSizingVertical) {
      try { (node as any).layoutSizingVertical = snap.layoutSizingVertical; } catch { /* */ }
    }
  }
}

async function loadFont(snap: any, fontCache: Set<string>, warnings: string[]) {
  const family = snap.style?.fontFamily || 'Inter';
  const weight = snap.style?.fontWeight ?? 400;
  const styleName = mapWeightToStyle(weight);
  const cacheKey = `${family}::${styleName}`;

  if (fontCache.has(cacheKey)) return;

  try {
    await figma.loadFontAsync({ family, style: styleName });
    fontCache.add(cacheKey);
  } catch {
    // Fallback to Inter Regular
    const fallbackKey = 'Inter::Regular';
    if (!fontCache.has(fallbackKey)) {
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        fontCache.add(fallbackKey);
      } catch { /* last resort, ignore */ }
    }
    warnings.push(`Font "${family} ${styleName}" unavailable — using Inter Regular`);
  }
}

function applyTextProperties(text: TextNode, snap: any, warnings: string[]) {
  const style = snap.style || {};
  const family = style.fontFamily || 'Inter';
  const weight = style.fontWeight ?? 400;
  const styleName = mapWeightToStyle(weight);

  // Set font — if the desired font couldn't be loaded, fallback to Inter
  try {
    text.fontName = { family, style: styleName };
  } catch {
    try {
      text.fontName = { family: 'Inter', style: 'Regular' };
    } catch { /* */ }
  }

  // Set text content
  if (snap.characters != null) {
    text.characters = String(snap.characters);
  }

  // Font size
  if (typeof style.fontSize === 'number') text.fontSize = style.fontSize;

  // Text alignment
  if (style.textAlignHorizontal) {
    const align = style.textAlignHorizontal as string;
    if (['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'].includes(align)) {
      text.textAlignHorizontal = align as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    }
  }
  if (style.textAlignVertical) {
    const align = style.textAlignVertical as string;
    if (['TOP', 'CENTER', 'BOTTOM'].includes(align)) {
      text.textAlignVertical = align as 'TOP' | 'CENTER' | 'BOTTOM';
    }
  }

  // Line height
  if (typeof style.lineHeightPx === 'number') {
    text.lineHeight = { value: style.lineHeightPx, unit: 'PIXELS' };
  } else if (typeof style.lineHeightPercent === 'number') {
    text.lineHeight = { value: style.lineHeightPercent, unit: 'PERCENT' };
  }

  // Letter spacing
  if (typeof style.letterSpacing === 'number') {
    text.letterSpacing = { value: style.letterSpacing, unit: 'PIXELS' };
  }

  // Text decoration
  if (style.textDecoration === 'UNDERLINE') {
    text.textDecoration = 'UNDERLINE';
  } else if (style.textDecoration === 'STRIKETHROUGH') {
    text.textDecoration = 'STRIKETHROUGH';
  }

  // Text case
  if (style.textCase) {
    try { text.textCase = style.textCase; } catch { /* */ }
  }

  // Text auto-resize
  if (snap.style?.textAutoResize) {
    try { text.textAutoResize = snap.style.textAutoResize; } catch { /* */ }
  }
}

// ── Paint & effect converters ────────────────────────

function convertPaints(restPaints: any[]): Paint[] {
  const paints: Paint[] = [];
  for (const rp of restPaints) {
    if (rp.visible === false) continue;
    const paint = convertSinglePaint(rp);
    if (paint) paints.push(paint);
  }
  return paints;
}

function convertSinglePaint(rp: any): Paint | null {
  switch (rp.type) {
    case 'SOLID': {
      const color = rp.color || { r: 0, g: 0, b: 0 };
      return {
        type: 'SOLID',
        color: { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0 },
        opacity: rp.opacity ?? 1,
        visible: rp.visible !== false,
      };
    }
    case 'GRADIENT_LINEAR':
    case 'GRADIENT_RADIAL':
    case 'GRADIENT_ANGULAR':
    case 'GRADIENT_DIAMOND': {
      const stops: ColorStop[] = (rp.gradientStops || []).map((gs: any) => ({
        position: gs.position ?? 0,
        color: {
          r: gs.color?.r ?? 0,
          g: gs.color?.g ?? 0,
          b: gs.color?.b ?? 0,
          a: gs.color?.a ?? 1,
        },
      }));
      if (stops.length === 0) return null;
      // Provide default gradient handle positions
      const gradientTransform: Transform = rp.gradientHandlePositions
        ? computeGradientTransform(rp.gradientHandlePositions)
        : [[1, 0, 0], [0, 1, 0]];
      return {
        type: rp.type as any,
        gradientStops: stops,
        gradientTransform,
        visible: rp.visible !== false,
        opacity: rp.opacity ?? 1,
      } as GradientPaint;
    }
    case 'IMAGE':
      // Can't reconstruct images — REST API only has imageRef hashes
      return null;
    default:
      return null;
  }
}

function computeGradientTransform(handles: any[]): Transform {
  if (!handles || handles.length < 2) return [[1, 0, 0], [0, 1, 0]];
  // Simple linear approximation from handle positions
  const p0 = handles[0] || { x: 0, y: 0 };
  const p1 = handles[1] || { x: 1, y: 0 };
  const dx = (p1.x ?? 1) - (p0.x ?? 0);
  const dy = (p1.y ?? 0) - (p0.y ?? 0);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const cos = dx / len;
  const sin = dy / len;
  return [
    [cos, sin, p0.x ?? 0],
    [-sin, cos, p0.y ?? 0],
  ];
}

function convertEffects(restEffects: any[]): Effect[] {
  const effects: Effect[] = [];
  for (const re of restEffects) {
    if (re.visible === false) continue;
    const effect = convertSingleEffect(re);
    if (effect) effects.push(effect);
  }
  return effects;
}

function convertSingleEffect(re: any): Effect | null {
  const color = re.color ? {
    r: re.color.r ?? 0,
    g: re.color.g ?? 0,
    b: re.color.b ?? 0,
    a: re.color.a ?? 1,
  } : { r: 0, g: 0, b: 0, a: 0.25 };

  switch (re.type) {
    case 'DROP_SHADOW':
      return {
        type: 'DROP_SHADOW',
        color,
        offset: { x: re.offset?.x ?? 0, y: re.offset?.y ?? 4 },
        radius: re.radius ?? 4,
        spread: re.spread ?? 0,
        visible: re.visible !== false,
        blendMode: re.blendMode || 'NORMAL',
      } as DropShadowEffect;
    case 'INNER_SHADOW':
      return {
        type: 'INNER_SHADOW',
        color,
        offset: { x: re.offset?.x ?? 0, y: re.offset?.y ?? 4 },
        radius: re.radius ?? 4,
        spread: re.spread ?? 0,
        visible: re.visible !== false,
        blendMode: re.blendMode || 'NORMAL',
      } as InnerShadowEffect;
    case 'LAYER_BLUR':
      return {
        type: 'LAYER_BLUR',
        radius: re.radius ?? 4,
        visible: re.visible !== false,
      } as BlurEffect;
    case 'BACKGROUND_BLUR':
      return {
        type: 'BACKGROUND_BLUR',
        radius: re.radius ?? 4,
        visible: re.visible !== false,
      } as BlurEffect;
    default:
      return null;
  }
}

// ── Utilities ────────────────────────────────────────

function mapWeightToStyle(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'ExtraLight';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'SemiBold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'ExtraBold';
  return 'Black';
}

function computeRelativePosition(childSnap: any, parentSnap: any): { x: number; y: number } {
  const cBB = childSnap.absoluteBoundingBox;
  const pBB = parentSnap.absoluteBoundingBox;
  if (!cBB || !pBB) return { x: 0, y: 0 };
  return {
    x: (cBB.x ?? 0) - (pBB.x ?? 0),
    y: (cBB.y ?? 0) - (pBB.y ?? 0),
  };
}
