import type { UIMessage, CodeMessage, ExtractedComponent } from './types';

figma.showUI(__html__, { width: 480, height: 640 });
figma.skipInvisibleInstanceChildren = true;

// Send init message
const userName = figma.currentUser?.name || 'unknown';
const fileKey = figma.fileKey || '';

function sendToUI(msg: CodeMessage) {
  figma.ui.postMessage(msg);
}

function sendProgress(message: string, percent: number) {
  sendToUI({ type: 'extraction-progress', message, percent });
}

sendToUI({ type: 'init', userName, fileKey });

// Message handler
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'extract-components':
      await extractComponents(msg.scope);
      break;

    case 'extract-single':
      await extractSingle(msg.nodeId);
      break;

    case 'navigate':
      navigateToNode(msg.nodeId);
      break;

    case 'reconstruct':
      // Phase 4: stub
      break;
  }
};

async function extractComponents(scope: 'page' | 'selection') {
  try {
    sendProgress('discovering components...', 5);

    let nodes: (ComponentNode | ComponentSetNode)[];

    if (scope === 'selection') {
      nodes = [];
      for (const node of figma.currentPage.selection) {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          nodes.push(node);
        }
        if ('findAllWithCriteria' in node) {
          const found = (node as FrameNode).findAllWithCriteria({
            types: ['COMPONENT', 'COMPONENT_SET'],
          });
          nodes.push(...found);
        }
      }
    } else {
      nodes = figma.currentPage.findAllWithCriteria({
        types: ['COMPONENT', 'COMPONENT_SET'],
      });
    }

    // Deduplicate: prefer COMPONENT_SET over its children
    const setIds = new Set(
      nodes
        .filter((n): n is ComponentSetNode => n.type === 'COMPONENT_SET')
        .map((n) => n.id)
    );
    const filtered = nodes.filter((n) => {
      if (n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET') {
        return !setIds.has(n.parent.id);
      }
      return true;
    });

    // Deduplicate by id
    const unique = [...new Map(filtered.map((n) => [n.id, n])).values()];

    sendProgress(`found ${unique.length} components. extracting...`, 15);

    const results: ExtractedComponent[] = [];
    const total = unique.length;

    for (let i = 0; i < total; i++) {
      const node = unique[i];
      const percent = 15 + Math.round((i / total) * 80);
      sendProgress(`extracting ${node.name}... (${i + 1}/${total})`, percent);

      // Yield to UI
      if (i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }

      try {
        // Export JSON snapshot
        const jsonBytes = await node.exportAsync({ format: 'JSON_REST_V1' } as any);
        const jsonString = String.fromCharCode(...new Uint8Array(jsonBytes));
        const snapshot = JSON.parse(jsonString);

        // Export thumbnail
        const pngBytes = await node.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });

        // Get component key
        const key = 'key' in node ? (node as ComponentNode).key : node.id;

        // Get property definitions
        let propertyDefinitions: any = null;
        if ('componentPropertyDefinitions' in node) {
          propertyDefinitions = node.componentPropertyDefinitions;
        }

        // Count variants
        let variantCount = 1;
        if (node.type === 'COMPONENT_SET') {
          variantCount = node.children.length;
        }

        // Count properties
        const propertyCount = propertyDefinitions
          ? Object.keys(propertyDefinitions).length
          : 0;

        // Get publish status
        const publishStatus = await (node as ComponentNode).getPublishStatusAsync();

        // Collect bound variables (shallow — top-level only for now)
        const variablesUsed: string[] = [];
        if ('boundVariables' in node && node.boundVariables) {
          for (const [prop, binding] of Object.entries(node.boundVariables as Record<string, any>)) {
            if (binding && typeof binding === 'object' && 'id' in binding) {
              variablesUsed.push(`${prop}:${binding.id}`);
            }
          }
        }

        results.push({
          key,
          name: node.name,
          nodeId: node.id,
          snapshot,
          propertyDefinitions,
          variablesUsed,
          thumbnailBytes: Array.from(new Uint8Array(pngBytes)),
          publishStatus,
          variantCount,
          propertyCount,
        });
      } catch (err: any) {
        console.error(`Failed to extract ${node.name}:`, err);
      }
    }

    sendProgress('extraction complete', 100);
    sendToUI({ type: 'extraction-complete', components: results });
  } catch (err: any) {
    sendToUI({ type: 'error', message: err.message || 'extraction failed' });
  }
}

async function extractSingle(nodeId: string) {
  const node = figma.getNodeById(nodeId);
  if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
    sendToUI({ type: 'error', message: 'node not found or not a component' });
    return;
  }

  sendProgress(`extracting ${node.name}...`, 50);

  try {
    const jsonBytes = await node.exportAsync({ format: 'JSON_REST_V1' } as any);
    const jsonString = String.fromCharCode(...new Uint8Array(jsonBytes));
    const snapshot = JSON.parse(jsonString);

    const pngBytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });

    const key = 'key' in node ? (node as ComponentNode).key : node.id;
    let propertyDefinitions: any = null;
    if ('componentPropertyDefinitions' in node) {
      propertyDefinitions = node.componentPropertyDefinitions;
    }
    let variantCount = 1;
    if (node.type === 'COMPONENT_SET') {
      variantCount = node.children.length;
    }
    const propertyCount = propertyDefinitions ? Object.keys(propertyDefinitions).length : 0;
    const publishStatus = await (node as ComponentNode).getPublishStatusAsync();

    sendToUI({
      type: 'extraction-complete',
      components: [{
        key,
        name: node.name,
        nodeId: node.id,
        snapshot,
        propertyDefinitions,
        variablesUsed: [],
        thumbnailBytes: Array.from(new Uint8Array(pngBytes)),
        publishStatus,
        variantCount,
        propertyCount,
      }],
    });
  } catch (err: any) {
    sendToUI({ type: 'error', message: err.message || 'extraction failed' });
  }
}

function navigateToNode(nodeId: string) {
  const node = figma.getNodeById(nodeId);
  if (node && 'x' in node) {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }
}
