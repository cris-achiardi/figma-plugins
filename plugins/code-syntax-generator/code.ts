// Show UI with specified dimensions and theme colors
figma.showUI(__html__, { width: 400, height: 560, themeColors: true });

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

  if (msg.type === 'apply-code-syntax') {
    const { collectionId, platforms, conventions, prefix, normalizePrefix } = msg;

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
        const codeSyntax = buildCodeSyntax(variable, platforms, conventions, prefix, normalizePrefix);

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
      type: 'complete',
      count: updated
    });
  }
};

/**
 * Build code syntax object for a variable
 */
function buildCodeSyntax(
  variable: Variable,
  platforms: string[],
  conventions: Record<string, string>,
  prefix: string,
  normalizePrefix: boolean
): Record<string, string> {
  // Parse variable path from hierarchical name
  // Figma variables use "/" as separator: "background/primary/default"
  const path = variable.name.split('/');

  const syntax: Record<string, string> = {};

  for (const platform of platforms) {
    const convention = conventions[platform];
    syntax[platform] = formatPath(path, convention, prefix, normalizePrefix);
  }

  return syntax;
}

/**
 * Format path parts according to naming convention
 */
function formatPath(
  parts: string[],
  convention: string,
  prefix: string,
  normalizePrefix: boolean
): string {
  let formatted = '';

  switch (convention) {
    case 'camelCase':
      // background/primary/default → backgroundPrimaryDefault
      formatted = parts
        .map((p, i) => {
          const lower = p.toLowerCase();
          return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('');
      break;

    case 'snake_case':
      // background/primary/default → background_primary_default
      formatted = parts.map(p => p.toLowerCase()).join('_');
      break;

    case 'kebab-case':
      // background/primary/default → background-primary-default
      formatted = parts.map(p => p.toLowerCase()).join('-');
      break;

    case 'PascalCase':
      // background/primary/default → BackgroundPrimaryDefault
      formatted = parts.map(capitalize).join('');
      break;
  }

  // Add prefix if provided
  if (prefix) {
    if (normalizePrefix) {
      // Normalize prefix to match convention
      switch (convention) {
        case 'camelCase':
          // Split on separators and spaces, then convert to camelCase
          const camelParts = prefix.split(/[-_\s]+/).filter(p => p.length > 0);
          const camelPrefix = camelParts
            .map((p, i) => i === 0 ? p.toLowerCase() : capitalize(p))
            .join('');
          formatted = camelPrefix + capitalize(formatted);
          break;

        case 'snake_case':
          // Replace hyphens and spaces with underscores, convert to lowercase
          const snakePrefix = prefix.toLowerCase().replace(/[-\s]+/g, '_');
          formatted = `${snakePrefix}_${formatted}`;
          break;

        case 'kebab-case':
          // Replace underscores and spaces with hyphens, convert to lowercase
          const kebabPrefix = prefix.toLowerCase().replace(/[_\s]+/g, '-');
          formatted = `${kebabPrefix}-${formatted}`;
          break;

        case 'PascalCase':
          // Split on separators and spaces, then convert to PascalCase
          const pascalParts = prefix.split(/[-_\s]+/).filter(p => p.length > 0);
          const pascalPrefix = pascalParts.map(capitalize).join('');
          formatted = pascalPrefix + formatted;
          break;
      }
    } else {
      // Use prefix as-is, just add appropriate separator
      if (convention === 'camelCase') {
        formatted = prefix + capitalize(formatted);
      } else if (convention === 'PascalCase') {
        formatted = prefix + formatted;
      } else {
        const separator = convention === 'snake_case' ? '_' : '-';
        formatted = `${prefix}${separator}${formatted}`;
      }
    }
  }

  return formatted;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
