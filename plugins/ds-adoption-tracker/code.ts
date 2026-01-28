import { Scope, ComponentStats, DetachedInstance, AnalysisResult, UIMessage, CodeMessage } from './types';

// Show UI
figma.showUI(__html__, { width: 800, height: 600 });

// Skip invisible children for better performance
figma.skipInvisibleInstanceChildren = true;

// Send initial state
function sendInit() {
  const selection = figma.currentPage.selection;
  const msg: CodeMessage = {
    type: 'init',
    hasSelection: selection.length > 0,
    count: selection.length
  };
  figma.ui.postMessage(msg);
}

// Listen for selection changes
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  const msg: CodeMessage = {
    type: 'selection-changed',
    hasSelection: selection.length > 0,
    count: selection.length
  };
  figma.ui.postMessage(msg);
});

// Send progress updates
function sendProgress(message: string, percent: number) {
  const msg: CodeMessage = { type: 'analysis-progress', message, percent };
  figma.ui.postMessage(msg);
}

// Send error
function sendError(message: string) {
  const msg: CodeMessage = { type: 'error', message };
  figma.ui.postMessage(msg);
}

// Find parent instance (if nested)
function findParentInstance(node: SceneNode): InstanceNode | null {
  let parent = node.parent;
  while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    if (parent.type === 'INSTANCE') {
      return parent as InstanceNode;
    }
    parent = parent.parent;
  }
  return null;
}

// Get component name (handles variants by getting component set name)
function getComponentName(component: ComponentNode): string {
  // If component is part of a component set (variant), use component set name + variant
  if (component.parent && component.parent.type === 'COMPONENT_SET') {
    return `${component.parent.name} / ${component.name}`;
  }
  return component.name;
}

// Get instances from scope
async function getInstancesFromScope(scope: Scope): Promise<InstanceNode[]> {
  if (scope === 'file') {
    sendProgress('Loading all pages...', 5);
    await figma.loadAllPagesAsync();
    sendProgress('Finding instances across file...', 10);
    return figma.root.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[];
  } else if (scope === 'page') {
    sendProgress('Finding instances on current page...', 10);
    return figma.currentPage.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[];
  } else {
    // Selection scope
    sendProgress('Finding instances in selection...', 10);
    const instances: InstanceNode[] = [];
    for (const node of figma.currentPage.selection) {
      if (node.type === 'INSTANCE') {
        instances.push(node);
      }
      if ('findAllWithCriteria' in node) {
        const found = (node as FrameNode).findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[];
        instances.push(...found);
      }
    }
    return instances;
  }
}

// Get detached instances from scope
function getDetachedFromScope(scope: Scope): FrameNode[] {
  let frames: FrameNode[];

  if (scope === 'file') {
    frames = figma.root.findAllWithCriteria({ types: ['FRAME'] }) as FrameNode[];
  } else if (scope === 'page') {
    frames = figma.currentPage.findAllWithCriteria({ types: ['FRAME'] }) as FrameNode[];
  } else {
    frames = [];
    for (const node of figma.currentPage.selection) {
      if (node.type === 'FRAME' && node.detachedInfo) {
        frames.push(node);
      }
      if ('findAllWithCriteria' in node) {
        const found = (node as FrameNode).findAllWithCriteria({ types: ['FRAME'] }) as FrameNode[];
        frames.push(...found);
      }
    }
  }

  return frames.filter(f => f.detachedInfo !== null);
}

// Main analysis function
async function analyze(scope: Scope) {
  try {
    sendProgress('Starting analysis...', 0);

    // Get all instances
    const instances = await getInstancesFromScope(scope);
    sendProgress(`Found ${instances.length} instances`, 20);

    // Group by component
    const statsMap = new Map<string, ComponentStats>();
    const BATCH_SIZE = 100;

    for (let i = 0; i < instances.length; i += BATCH_SIZE) {
      const batch = instances.slice(i, i + BATCH_SIZE);
      const percent = 20 + Math.round((i / instances.length) * 50);
      sendProgress(`Analyzing instances... (${i}/${instances.length})`, percent);

      for (const instance of batch) {
        const main = await instance.getMainComponentAsync();
        if (!main) continue;

        const componentId = main.id;
        const existing = statsMap.get(componentId) || {
          id: main.id,
          key: main.key,
          name: getComponentName(main),
          libraryName: null, // Will be enhanced if we can resolve library
          isExternal: main.remote,
          instanceCount: 0,
          instanceIds: [],
          usedInComponents: [],
          nestedComponents: []
        };

        existing.instanceCount++;
        existing.instanceIds.push(instance.id);

        // Track parent component (if nested)
        const parentInstance = findParentInstance(instance);
        if (parentInstance) {
          const parentMain = await parentInstance.getMainComponentAsync();
          if (parentMain && !existing.usedInComponents.includes(parentMain.id)) {
            existing.usedInComponents.push(parentMain.id);
          }
        }

        statsMap.set(componentId, existing);
      }

      // Yield to UI
      await new Promise(r => setTimeout(r, 0));
    }

    // Build nested components data (reverse lookup)
    sendProgress('Building dependency graph...', 75);
    for (const [id, stats] of statsMap) {
      for (const parentId of stats.usedInComponents) {
        const parentStats = statsMap.get(parentId);
        if (parentStats && !parentStats.nestedComponents.includes(id)) {
          parentStats.nestedComponents.push(id);
        }
      }
    }

    // Get detached instances
    sendProgress('Finding detached instances...', 80);
    const detachedFrames = getDetachedFromScope(scope);
    const detachedInstances: DetachedInstance[] = detachedFrames.map(frame => ({
      frameId: frame.id,
      frameName: frame.name,
      originalComponentKey: frame.detachedInfo!.componentKey || '',
      originalComponentName: null // Could resolve if we track components
    }));

    // Build dependency graph
    const dependencyGraph: Record<string, string[]> = {};
    for (const [id, stats] of statsMap) {
      if (stats.nestedComponents.length > 0) {
        dependencyGraph[id] = stats.nestedComponents;
      }
    }

    // Build result
    const components = Array.from(statsMap.values()).sort((a, b) => b.instanceCount - a.instanceCount);
    const externalCount = components.filter(c => c.isExternal).length;

    const result: AnalysisResult = {
      scope,
      timestamp: new Date().toISOString(),
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      totalInstances: instances.length,
      totalDetached: detachedInstances.length,
      uniqueComponents: components.length,
      externalComponents: externalCount,
      localComponents: components.length - externalCount,
      components,
      detachedInstances,
      dependencies: {
        graph: dependencyGraph
      }
    };

    sendProgress('Analysis complete!', 100);

    const msg: CodeMessage = { type: 'analysis-complete', result };
    figma.ui.postMessage(msg);

  } catch (error) {
    sendError(`Analysis failed: ${error}`);
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
    case 'analyze':
      await analyze(msg.scope);
      break;
    case 'navigate':
      navigateToNode(msg.nodeId);
      break;
    case 'export':
      // Export is handled in UI (browser download)
      break;
  }
};

// Initialize
sendInit();
