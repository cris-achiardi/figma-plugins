// Show UI with specified dimensions and theme colors
figma.showUI(__html__, { width: 800, height: 680, themeColors: true });

// Listen for messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-collections') {
    // Get all local variable collections
    const collections = await figma.variables.getLocalVariableCollectionsAsync();

    // Send back to UI
    figma.ui.postMessage({
      type: 'collections-list',
      collections: collections.map(c => ({
        id: c.id,
        name: c.name
      }))
    });
  }

  if (msg.type === 'load-collection') {
    const { collectionId } = msg;

    // Get the selected collection
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) {
      figma.ui.postMessage({ type: 'error', message: 'Collection not found' });
      return;
    }

    // Get all variables in the collection
    const variablePromises = collection.variableIds.map(id =>
      figma.variables.getVariableByIdAsync(id)
    );
    const variables = (await Promise.all(variablePromises)).filter(v => v !== null);

    // Read existing code syntax
    const existingSyntax: Record<string, string[]> = {
      WEB: [],
      iOS: [],
      ANDROID: []
    };

    for (const variable of variables) {
      if (variable && variable.codeSyntax) {
        const webSyntax = variable.codeSyntax.WEB;
        const iosSyntax = variable.codeSyntax.iOS;
        const androidSyntax = variable.codeSyntax.ANDROID;

        if (webSyntax) existingSyntax.WEB.push(webSyntax);
        if (iosSyntax) existingSyntax.iOS.push(iosSyntax);
        if (androidSyntax) existingSyntax.ANDROID.push(androidSyntax);
      }
    }

    figma.ui.postMessage({
      type: 'existing-syntax-found',
      existingSyntax,
      hasExisting: {
        WEB: existingSyntax.WEB.length > 0,
        iOS: existingSyntax.iOS.length > 0,
        ANDROID: existingSyntax.ANDROID.length > 0
      }
    });
  }

  if (msg.type === 'generate-preview') {
    const { collectionId, platform, convention, prefix, suffix, omitParents = false, limit = 20 } = msg;

    try {
      const preview = await generatePreview(collectionId, platform, convention, prefix, suffix, omitParents, limit);

      // Get total count
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
      const total = collection ? collection.variableIds.length : 0;

      figma.ui.postMessage({
        type: 'preview-result',
        platform,
        previews: preview,
        total,
        showing: preview.length
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Preview generation failed: ${error}`
      });
    }
  }

  if (msg.type === 'apply-code-syntax') {
    const { collectionId, platforms, conventions, prefixes, suffixes, omitParents } = msg;

    // Get the selected collection
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) {
      figma.ui.postMessage({ type: 'error', message: 'Collection not found' });
      return;
    }

    // Get all variables in the collection
    const variablePromises = collection.variableIds.map(id =>
      figma.variables.getVariableByIdAsync(id)
    );
    const variables = (await Promise.all(variablePromises)).filter(v => v !== null);

    // Process each variable
    let updated = 0;
    for (const variable of variables) {
      if (variable) {
        const codeSyntax = buildCodeSyntax(variable, platforms, conventions, prefixes, suffixes, omitParents);

        // Set code syntax for each selected platform
        for (const platform of platforms) {
          if (codeSyntax[platform]) {
            variable.setVariableCodeSyntax(platform as 'WEB' | 'ANDROID' | 'iOS', codeSyntax[platform]);
          }
        }
        updated++;
      }
    }

    figma.ui.postMessage({
      type: 'apply-complete',
      count: updated,
      platforms
    });
  }

  if (msg.type === 'remove-code-syntax') {
    const { collectionId, platforms } = msg;
    console.log('Remove code syntax request:', { collectionId, platforms });

    // Get the selected collection
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) {
      console.log('Collection not found:', collectionId);
      figma.ui.postMessage({ type: 'error', message: 'Collection not found' });
      return;
    }

    console.log('Collection found:', collection.name, 'Variables:', collection.variableIds.length);

    // Get all variables in the collection
    const variablePromises = collection.variableIds.map(id =>
      figma.variables.getVariableByIdAsync(id)
    );
    const variables = (await Promise.all(variablePromises)).filter(v => v !== null);

    console.log('Loaded variables:', variables.length);

    // Remove code syntax for selected platforms
    let updated = 0;
    for (const variable of variables) {
      if (variable) {
        for (const platform of platforms) {
          console.log(`Removing ${platform} code syntax from ${variable.name}`);
          // Check if the variable has code syntax for this platform before attempting to remove
          const currentSyntax = variable.codeSyntax?.[platform as 'WEB' | 'ANDROID' | 'iOS'];
          if (currentSyntax) {
            // Use the proper removeVariableCodeSyntax method
            variable.removeVariableCodeSyntax(platform as 'WEB' | 'ANDROID' | 'iOS');
          }
        }
        updated++;
      }
    }

    console.log('Remove complete, updated:', updated);

    figma.ui.postMessage({
      type: 'remove-complete',
      count: updated,
      platforms
    });
  }
};

/**
 * Generate preview for a collection
 */
async function generatePreview(
  collectionId: string,
  platform: string,
  convention: string,
  prefix: string,
  suffix: string,
  omitParents: boolean = false,
  limit: number = 20
): Promise<Array<{ original: string; generated: string }>> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  if (!collection) {
    return [];
  }

  const variablePromises = collection.variableIds.map(id =>
    figma.variables.getVariableByIdAsync(id)
  );
  const variables = (await Promise.all(variablePromises)).filter(v => v !== null);

  const previewLimit = Math.min(limit, variables.length);

  return variables.slice(0, previewLimit).map(variable => {
    const path = variable!.name.split('/');
    const pathToUse = omitParents ? [path[path.length - 1]] : path;

    return {
      original: variable!.name,
      generated: formatPath(
        pathToUse,
        convention,
        prefix,
        suffix
      )
    };
  });
}

/**
 * Build code syntax object for a variable
 */
function buildCodeSyntax(
  variable: Variable,
  platforms: string[],
  conventions: Record<string, string>,
  prefixes: Record<string, string>,
  suffixes: Record<string, string>,
  omitParents: Record<string, boolean> = {}
): Record<string, string> {
  // Parse variable path from hierarchical name
  // Figma variables use "/" as separator: "background/primary/default"
  const path = variable.name.split('/');

  const syntax: Record<string, string> = {};

  for (const platform of platforms) {
    const convention = conventions[platform];
    const prefix = prefixes[platform];
    const suffix = suffixes[platform];
    const shouldOmitParents = omitParents[platform] || false;

    const pathToUse = shouldOmitParents ? [path[path.length - 1]] : path;
    syntax[platform] = formatPath(pathToUse, convention, prefix, suffix);
  }

  return syntax;
}

/**
 * Apply template to normalized token
 */
function applyTemplate(
  normalizedToken: string,
  prefix: string,
  suffix: string
): string {
  return `${prefix}${normalizedToken}${suffix}`;
}

/**
 * Normalize a path segment by removing spaces and special characters
 * Handles compound names like "font weight" → "fontWeight"
 */
function normalizeSegment(segment: string, convention: string, isFirst: boolean = false): string {
  // Split on spaces, hyphens, and underscores
  const words = segment.split(/[\s\-_]+/).filter(w => w.length > 0);

  if (words.length === 0) return '';

  switch (convention) {
    case 'camelCase':
      return words
        .map((w, i) => {
          const lower = w.toLowerCase();
          // First word of first segment stays lowercase, all others capitalize
          return (isFirst && i === 0) ? lower : capitalize(lower);
        })
        .join('');

    case 'snake_case':
      return words.map(w => w.toLowerCase()).join('_');

    case 'kebab-case':
      return words.map(w => w.toLowerCase()).join('-');

    case 'PascalCase':
      return words.map(w => capitalize(w.toLowerCase())).join('');

    default:
      return segment;
  }
}

/**
 * Format path parts according to naming convention with template
 */
function formatPath(
  parts: string[],
  convention: string,
  prefix: string,
  suffix: string
): string {
  // Normalize each segment according to convention
  const normalizedSegments = parts.map((segment, index) =>
    normalizeSegment(segment, convention, index === 0)
  );

  // Join segments with appropriate separator
  const separator = getSeparatorForConvention(convention);
  const normalizedToken = normalizedSegments.join(separator);

  // Apply template
  return applyTemplate(normalizedToken, prefix, suffix);
}

/**
 * Get separator for naming convention
 */
function getSeparatorForConvention(convention: string): string {
  switch (convention) {
    case 'camelCase':
    case 'PascalCase':
      return '';
    case 'snake_case':
      return '_';
    case 'kebab-case':
      return '-';
    default:
      return '';
  }
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
