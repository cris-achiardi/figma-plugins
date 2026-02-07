import { ExtractedComponent, LocalComponentGroup, UIMessage, CodeMessage } from './types';
import { reconstructFromSnapshot } from './reconstruct';

// Show UI
figma.showUI(__html__, { width: 480, height: 640 });
figma.skipInvisibleInstanceChildren = true;

// Send initial state (with saved OAuth settings from clientStorage)
async function sendInit() {
  const [savedToken, savedFileKey, savedUserName] = await Promise.all([
    figma.clientStorage.getAsync('figma_token').catch(() => null),
    figma.clientStorage.getAsync('figma_file_key').catch(() => null),
    figma.clientStorage.getAsync('figma_user_name').catch(() => null),
  ]);

  const msg: CodeMessage = {
    type: 'init',
    userName: figma.currentUser?.name || 'unknown',
    photoUrl: figma.currentUser?.photoUrl || null,
    fileKey: figma.root.name,
    savedToken: savedToken || undefined,
    savedFileKey: savedFileKey || undefined,
    savedUserName: savedUserName || undefined,
  };
  figma.ui.postMessage(msg);
}

// Send progress updates
function sendProgress(message: string, percent: number) {
  const msg: CodeMessage = { type: 'extraction-progress', message, percent };
  figma.ui.postMessage(msg);
}

// Send error
function sendError(message: string) {
  const msg: CodeMessage = { type: 'error', message };
  figma.ui.postMessage(msg);
}

// Get component name (handles variants by getting component set name)
function getComponentName(node: ComponentNode | ComponentSetNode): string {
  if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') {
    return node.parent.name;
  }
  return node.name;
}

// Collect bound variables recursively from a node tree
function collectBoundVariables(node: SceneNode): Record<string, any> {
  const vars: Record<string, any> = {};

  if ('boundVariables' in node && node.boundVariables) {
    for (const [prop, binding] of Object.entries(node.boundVariables as Record<string, any>)) {
      if (binding) {
        vars[`${node.name}.${prop}`] = binding;
      }
    }
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      const childVars = collectBoundVariables(child as SceneNode);
      Object.assign(vars, childVars);
    }
  }

  return vars;
}

// Extract specific components by node IDs (used after library list selection)
async function extractSelected(nodeIds: string[]) {
  try {
    sendProgress('Starting extraction...', 5);
    const extracted: ExtractedComponent[] = [];

    for (let i = 0; i < nodeIds.length; i++) {
      const node = await figma.getNodeByIdAsync(nodeIds[i]);
      if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) continue;

      const compNode = node as ComponentNode | ComponentSetNode;
      const name = getComponentName(compNode);
      const percent = 5 + Math.round((i / nodeIds.length) * 90);
      sendProgress(`Extracting: ${name} (${i + 1}/${nodeIds.length})`, percent);

      try {
        const snapshot = await compNode.exportAsync({ format: 'JSON_REST_V1' } as any);
        const pngBytes = await compNode.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });

        let propertyDefinitions: any = null;
        if (compNode.type === 'COMPONENT_SET') {
          propertyDefinitions = compNode.componentPropertyDefinitions;
        } else if (compNode.type === 'COMPONENT' && compNode.parent?.type !== 'COMPONENT_SET') {
          propertyDefinitions = compNode.componentPropertyDefinitions;
        }

        const variablesUsed = collectBoundVariables(compNode);
        const publishStatus = await compNode.getPublishStatusAsync();

        extracted.push({
          key: compNode.key,
          name,
          nodeId: compNode.id,
          snapshot,
          propertyDefinitions,
          variablesUsed,
          thumbnailBytes: Array.from(pngBytes),
          publishStatus,
        });
      } catch (err) {
        console.error(`Failed to extract ${name}:`, err);
      }

      await new Promise(r => setTimeout(r, 0));
    }

    sendProgress('Extraction complete!', 100);
    const msg: CodeMessage = { type: 'extraction-complete', components: extracted };
    figma.ui.postMessage(msg);
  } catch (error) {
    sendError(`Extraction failed: ${error}`);
  }
}

// Extract a single component by node ID
async function extractSingle(nodeId: string) {
  try {
    sendProgress('Extracting component...', 20);
    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
      sendError('Node is not a component.');
      return;
    }

    const compNode = node as ComponentNode | ComponentSetNode;
    const name = getComponentName(compNode);
    sendProgress(`Extracting: ${name}`, 50);

    const snapshot = await compNode.exportAsync({ format: 'JSON_REST_V1' } as any);
    const pngBytes = await compNode.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });

    let propertyDefinitions: any = null;
    if (compNode.type === 'COMPONENT_SET') {
      propertyDefinitions = compNode.componentPropertyDefinitions;
    } else if (compNode.type === 'COMPONENT' && compNode.parent?.type !== 'COMPONENT_SET') {
      propertyDefinitions = compNode.componentPropertyDefinitions;
    }

    const variablesUsed = collectBoundVariables(compNode);
    const publishStatus = await compNode.getPublishStatusAsync();

    const extracted: ExtractedComponent = {
      key: compNode.key,
      name,
      nodeId: compNode.id,
      snapshot,
      propertyDefinitions,
      variablesUsed,
      thumbnailBytes: Array.from(pngBytes),
      publishStatus,
    };

    sendProgress('Done!', 100);
    const msg: CodeMessage = { type: 'extraction-complete', components: [extracted] };
    figma.ui.postMessage(msg);
  } catch (error) {
    sendError(`Extraction failed: ${error}`);
  }
}

// Navigate to a node
async function navigateToNode(nodeId: string) {
  const node = await figma.getNodeByIdAsync(nodeId) as SceneNode;
  if (node) {
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
  }
}

// Save OAuth settings to clientStorage
async function saveSettings(token: string, fileKey: string, userName: string) {
  await Promise.all([
    figma.clientStorage.setAsync('figma_token', token),
    figma.clientStorage.setAsync('figma_file_key', fileKey),
    figma.clientStorage.setAsync('figma_user_name', userName),
  ]);
}

// Clear stored OAuth settings
async function clearSettings() {
  await Promise.all([
    figma.clientStorage.deleteAsync('figma_token'),
    figma.clientStorage.deleteAsync('figma_file_key'),
    figma.clientStorage.deleteAsync('figma_user_name'),
  ]);
}

// Scan local components and component sets from the document
async function scanLocalComponents() {
  try {
    sendProgress('Loading pages...', 10);
    await figma.loadAllPagesAsync();

    sendProgress('Scanning components...', 20);
    const groups: LocalComponentGroup[] = [];

    // Find all component sets (these contain variants)
    const componentSets = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET'] });
    const variantNodeIds = new Set<string>();

    for (const cs of componentSets) {
      const csNode = cs as ComponentSetNode;
      const variants = csNode.children.filter(c => c.type === 'COMPONENT') as ComponentNode[];
      variants.forEach(v => variantNodeIds.add(v.id));

      groups.push({
        name: csNode.name,
        nodeId: csNode.id,
        key: csNode.key,
        thumbnailBytes: [],
        variantCount: variants.length,
        variants: variants.map(v => ({ name: v.name, nodeId: v.id, key: v.key })),
      });
    }

    // Find standalone components (not inside a component set)
    const allComponents = figma.root.findAllWithCriteria({ types: ['COMPONENT'] });
    const standalones = allComponents.filter(c => !variantNodeIds.has(c.id)) as ComponentNode[];

    for (const comp of standalones) {
      groups.push({
        name: comp.name,
        nodeId: comp.id,
        key: comp.key,
        thumbnailBytes: [],
        variantCount: 1,
        variants: [{ name: comp.name, nodeId: comp.id, key: comp.key }],
      });
    }

    groups.sort((a, b) => a.name.localeCompare(b.name));
    sendProgress('Scan complete!', 100);
    const msg: CodeMessage = { type: 'local-components', groups };
    figma.ui.postMessage(msg);
  } catch (error) {
    sendError(`Scan failed: ${error}`);
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'extract-selected':
      await extractSelected(msg.nodeIds);
      break;
    case 'extract-single':
      await extractSingle(msg.nodeId);
      break;
    case 'navigate':
      await navigateToNode(msg.nodeId);
      break;
    case 'save-settings':
      await saveSettings(msg.token, msg.fileKey, msg.userName);
      break;
    case 'load-settings': {
      const [token, fileKey, userName] = await Promise.all([
        figma.clientStorage.getAsync('figma_token').catch(() => null),
        figma.clientStorage.getAsync('figma_file_key').catch(() => null),
        figma.clientStorage.getAsync('figma_user_name').catch(() => null),
      ]);
      const response: CodeMessage = { type: 'settings-loaded', token, fileKey, userName };
      figma.ui.postMessage(response);
      break;
    }
    case 'clear-settings':
      await clearSettings();
      break;
    case 'scan-local-components':
      await scanLocalComponents();
      break;
    case 'reconstruct-copy': {
      try {
        const result = await reconstructFromSnapshot(msg.snapshot, {
          componentName: msg.componentName,
          onProgress: (message, percent) => {
            const prog: CodeMessage = { type: 'reconstruct-progress', message, percent };
            figma.ui.postMessage(prog);
          },
        });
        const done: CodeMessage = { type: 'reconstruct-complete', nodeId: result.nodeId, warnings: result.warnings };
        figma.ui.postMessage(done);
      } catch (err) {
        sendError(`Reconstruction failed: ${err}`);
      }
      break;
    }
  }
};

// Initialize
sendInit();
