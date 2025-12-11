// Show UI with specified dimensions and theme colors
figma.showUI(__html__, { width: 400, height: 540, themeColors: true });

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
      // font weight/bold → fontWeightBold (handles spaces)
      formatted = parts
        .map((p, i) => normalizeSegment(p, convention, i === 0))
        .join('');
      break;

    case 'snake_case':
      // background/primary/default → background_primary_default
      // font weight/bold → font_weight_bold (handles spaces)
      formatted = parts.map(p => normalizeSegment(p, convention)).join('_');
      break;

    case 'kebab-case':
      // background/primary/default → background-primary-default
      // font weight/bold → font-weight-bold (handles spaces)
      formatted = parts.map(p => normalizeSegment(p, convention)).join('-');
      break;

    case 'PascalCase':
      // background/primary/default → BackgroundPrimaryDefault
      // font weight/bold → FontWeightBold (handles spaces)
      formatted = parts.map(p => normalizeSegment(p, convention)).join('');
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
