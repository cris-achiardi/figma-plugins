import { Scope, ExtractedComponent, UIMessage, CodeMessage } from './types';

// Show UI
figma.showUI(__html__, { width: 480, height: 640 });
figma.skipInvisibleInstanceChildren = true;

// Send initial state
function sendInit() {
  const msg: CodeMessage = {
    type: 'init',
    userName: figma.currentUser?.name || 'unknown',
    fileKey: figma.root.name,
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

// Discover components from scope
function getComponentsFromScope(scope: Scope): (ComponentNode | ComponentSetNode)[] {
  const nodes = scope === 'page'
    ? figma.currentPage.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })
    : (() => {
        const results: (ComponentNode | ComponentSetNode)[] = [];
        for (const sel of figma.currentPage.selection) {
          if (sel.type === 'COMPONENT' || sel.type === 'COMPONENT_SET') {
            results.push(sel);
          }
          if ('findAllWithCriteria' in sel) {
            const found = (sel as FrameNode).findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
            results.push(...found);
          }
        }
        return results;
      })();

  // Deduplicate: prefer COMPONENT_SET over its child COMPONENTs
  const setIds = new Set<string>();
  const filtered: (ComponentNode | ComponentSetNode)[] = [];

  // First pass: collect all component set ids
  for (const node of nodes) {
    if (node.type === 'COMPONENT_SET') {
      setIds.add(node.id);
    }
  }

  // Second pass: skip COMPONENTs whose parent is an already-included COMPONENT_SET
  for (const node of nodes) {
    if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET' && setIds.has(node.parent.id)) {
      continue; // parent set is already included
    }
    filtered.push(node);
  }

  return filtered;
}

// Extract all components
async function extractComponents(scope: Scope) {
  try {
    sendProgress('Discovering components...', 5);
    const components = getComponentsFromScope(scope);

    if (components.length === 0) {
      sendError('No components found in the selected scope.');
      return;
    }

    sendProgress(`Found ${components.length} components`, 10);
    const extracted: ExtractedComponent[] = [];

    for (let i = 0; i < components.length; i++) {
      const node = components[i];
      const percent = 10 + Math.round((i / components.length) * 80);
      const name = getComponentName(node);
      sendProgress(`Extracting: ${name} (${i + 1}/${components.length})`, percent);

      try {
        // Export JSON snapshot
        const snapshot = await node.exportAsync({ format: 'JSON_REST_V1' } as any);

        // Export PNG thumbnail
        const pngBytes = await node.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });

        // Get property definitions (only on COMPONENT_SET or standalone COMPONENT)
        let propertyDefinitions: any = null;
        if (node.type === 'COMPONENT_SET') {
          propertyDefinitions = node.componentPropertyDefinitions;
        } else if (node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET') {
          propertyDefinitions = node.componentPropertyDefinitions;
        }

        // Collect bound variables
        const variablesUsed = collectBoundVariables(node);

        // Get component key for stable identification
        const key = node.key;

        // Get publish status
        const publishStatus = await node.getPublishStatusAsync();

        extracted.push({
          key,
          name,
          nodeId: node.id,
          snapshot,
          propertyDefinitions,
          variablesUsed,
          thumbnailBytes: Array.from(pngBytes),
          publishStatus,
        });
      } catch (err) {
        console.error(`Failed to extract ${name}:`, err);
      }

      // Yield to UI
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

// Handle messages from UI
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'extract-components':
      await extractComponents(msg.scope);
      break;
    case 'extract-single':
      await extractSingle(msg.nodeId);
      break;
    case 'navigate':
      await navigateToNode(msg.nodeId);
      break;
    case 'reconstruct':
      // Stub for future reconstruction feature
      sendError('Reconstruction not yet implemented.');
      break;
  }
};

// Initialize
sendInit();
