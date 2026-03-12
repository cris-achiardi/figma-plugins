import { UIMessage, CodeMessage, SelectionInfo } from './types';
import { reconstructFromSnapshot } from './reconstruct';

// Show UI
figma.showUI(__html__, { width: 420, height: 520 });

// ── Vector types whose geometry the REST API omits ──────

const VECTOR_TYPES = new Set(['VECTOR', 'STAR', 'REGULAR_POLYGON', 'LINE', 'BOOLEAN_OPERATION']);

// ── Collect SVG exports for vector nodes ────────────────

async function collectVectorSvgs(node: SceneNode): Promise<Record<string, string>> {
  const svgMap: Record<string, string> = {};

  async function walk(n: SceneNode) {
    if (VECTOR_TYPES.has(n.type)) {
      try {
        const svgBytes = await n.exportAsync({ format: 'SVG' });
        svgMap[n.id] = String.fromCharCode(...svgBytes);
      } catch { /* skip nodes that fail SVG export */ }
    }
    if ('children' in n) {
      for (const child of (n as ChildrenMixin).children) {
        await walk(child as SceneNode);
      }
    }
  }

  await walk(node);
  return svgMap;
}

// ── Inject SVG data into snapshot tree ──────────────────

function injectSvgData(snapNode: any, svgMap: Record<string, string>) {
  if (!snapNode) return;
  if (snapNode.id && svgMap[snapNode.id]) {
    snapNode._svgData = svgMap[snapNode.id];
  }
  if (snapNode.children && Array.isArray(snapNode.children)) {
    for (const child of snapNode.children) {
      injectSvgData(child, svgMap);
    }
  }
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
  const info = getSelectionInfo();
  const msg: CodeMessage = { type: 'selection-changed', info };
  figma.ui.postMessage(msg);
}

figma.on('selectionchange', pushSelection);

// ── Export handler ───────────────────────────────────────

async function handleExport(includeSvg: boolean) {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    const err: CodeMessage = { type: 'error', message: 'Select exactly one node to export.' };
    figma.ui.postMessage(err);
    return;
  }

  const node = sel[0];
  try {
    const prog1: CodeMessage = { type: 'export-progress', message: 'Exporting JSON...', percent: 20 };
    figma.ui.postMessage(prog1);

    const snapshot = await node.exportAsync({ format: 'JSON_REST_V1' } as any);

    if (includeSvg) {
      const prog2: CodeMessage = { type: 'export-progress', message: 'Collecting SVG data...', percent: 60 };
      figma.ui.postMessage(prog2);

      const svgMap = await collectVectorSvgs(node);
      if (Object.keys(svgMap).length > 0 && snapshot?.document) {
        injectSvgData(snapshot.document, svgMap);
      }
    }

    const prog3: CodeMessage = { type: 'export-progress', message: 'Serializing...', percent: 90 };
    figma.ui.postMessage(prog3);

    const json = JSON.stringify(snapshot, null, 2);

    const done: CodeMessage = { type: 'export-complete', json };
    figma.ui.postMessage(done);
    figma.notify(`Exported "${node.name}" (${(json.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    const errMsg: CodeMessage = { type: 'error', message: `Export failed: ${err}` };
    figma.ui.postMessage(errMsg);
  }
}

// ── Import handler ──────────────────────────────────────

async function handleImport(snapshot: any, componentName: string) {
  try {
    const result = await reconstructFromSnapshot(snapshot, {
      componentName,
      onProgress: (message, percent) => {
        const prog: CodeMessage = { type: 'import-progress', message, percent };
        figma.ui.postMessage(prog);
      },
    });

    const done: CodeMessage = { type: 'import-complete', nodeId: result.nodeId, warnings: result.warnings };
    figma.ui.postMessage(done);

    const warnCount = result.warnings.length;
    figma.notify(
      warnCount > 0
        ? `Reconstructed "${componentName}" with ${warnCount} warning${warnCount === 1 ? '' : 's'}`
        : `Reconstructed "${componentName}"`,
    );
  } catch (err) {
    const errMsg: CodeMessage = { type: 'error', message: `Import failed: ${err}` };
    figma.ui.postMessage(errMsg);
  }
}

// ── Message handler ─────────────────────────────────────

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'export':
      await handleExport(msg.includeSvg);
      break;
    case 'import':
      await handleImport(msg.snapshot, msg.componentName);
      break;
    case 'resize':
      figma.ui.resize(420, msg.height);
      break;
  }
};

// Push initial selection
pushSelection();
