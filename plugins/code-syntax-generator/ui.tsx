import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dropdown, Input, Checkbox, theme } from '@figma-plugins/shared-ui';

console.log('UI script executing');

interface Collection {
  id: string;
  name: string;
}

type Platform = 'WEB' | 'iOS' | 'ANDROID';
type NamingConvention = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

function App() {
  console.log('App component rendering');
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = React.useState('');
  const [platforms, setPlatforms] = React.useState<Record<Platform, boolean>>({
    WEB: true,
    iOS: false,
    ANDROID: false
  });
  const [conventions, setConventions] = React.useState<Record<Platform, NamingConvention>>({
    WEB: 'camelCase',
    iOS: 'camelCase',
    ANDROID: 'snake_case'
  });
  const [prefix, setPrefix] = React.useState('');
  const [normalizePrefix, setNormalizePrefix] = React.useState(true);
  const [status, setStatus] = React.useState<{
    type: 'success' | 'processing' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  React.useEffect(() => {
    // Request collections list on mount
    parent.postMessage({ pluginMessage: { type: 'get-collections' } }, '*');

    // Listen for messages from plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;

      if (msg.type === 'collections-list') {
        setCollections(msg.collections);
        // Auto-select first collection if available
        if (msg.collections.length > 0) {
          setSelectedCollection(msg.collections[0].id);
        }
      }

      if (msg.type === 'complete') {
        setStatus({
          type: 'success',
          message: `✓ Updated ${msg.count} variables with code syntax`
        });
      }

      if (msg.type === 'error') {
        setStatus({
          type: 'error',
          message: `Error: ${msg.message}`
        });
      }
    };
  }, []);

  const handlePlatformToggle = (platform: Platform) => {
    setPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleConventionChange = (platform: Platform, convention: NamingConvention) => {
    setConventions(prev => ({
      ...prev,
      [platform]: convention
    }));
  };

  const handleApply = () => {
    // Get enabled platforms
    const enabledPlatforms = (Object.keys(platforms) as Platform[])
      .filter(platform => platforms[platform]);

    if (enabledPlatforms.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one platform'
      });
      return;
    }

    // Send message to plugin
    parent.postMessage({
      pluginMessage: {
        type: 'apply-code-syntax',
        collectionId: selectedCollection,
        platforms: enabledPlatforms,
        conventions,
        prefix: prefix.trim(),
        normalizePrefix
      }
    }, '*');

    setStatus({
      type: 'processing',
      message: 'Processing variables...'
    });
  };

  const canApply = selectedCollection && Object.values(platforms).some(Boolean);

  const namingConventionOptions = [
    { value: 'camelCase', label: 'camelCase' },
    { value: 'snake_case', label: 'snake_case' },
    { value: 'kebab-case', label: 'kebab-case' },
    { value: 'PascalCase', label: 'PascalCase' },
  ];

  return (
    <div style={{
      padding: theme.spacing.lg,
      fontFamily: theme.typography.fontFamily.default,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.lg,
    }}>
      <h2 style={{
        margin: 0,
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.textPrimary,
      }}>
        Bulk Code Syntax
      </h2>

      <Dropdown
        label="Variable Collection"
        value={selectedCollection}
        onChange={value => setSelectedCollection(value)}
        options={collections.length === 0
          ? [{ value: '', label: 'No collections found' }]
          : collections.map(c => ({ value: c.id, label: c.name }))
        }
        fullWidth
      />

      <fieldset style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        margin: 0,
      }}>
        <legend style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.textPrimary,
          padding: `0 ${theme.spacing.xs}`,
        }}>
          Platforms & Naming Conventions
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {(Object.keys(platforms) as Platform[]).map(platform => {
            const platformLabels: Record<Platform, string> = {
              WEB: 'Web',
              iOS: 'iOS',
              ANDROID: 'Android',
            };

            return (
              <div key={platform} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: '30px',
              }}>
                <Checkbox
                  checked={platforms[platform]}
                  onChange={() => handlePlatformToggle(platform)}
                  label={platformLabels[platform]}
                />
                {platforms[platform] && (
                  <Dropdown
                    value={conventions[platform]}
                    onChange={value => handleConventionChange(
                      platform,
                      value as NamingConvention
                    )}
                    options={namingConventionOptions}
                    style={{ minWidth: '140px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <Input
        label="Prefix (optional)"
        type="text"
        value={prefix}
        onChange={e => setPrefix(e.target.value)}
        placeholder="e.g., ds, test-ds, myPrefix"
        fullWidth
      />

      {prefix && (
        <Checkbox
          checked={normalizePrefix}
          onChange={e => setNormalizePrefix(e.target.checked)}
          label="Normalize prefix to match naming convention"
        />
      )}

      <Button
        onClick={handleApply}
        disabled={!canApply}
        variant="primary"
        fullWidth
      >
        Apply Code Syntax
      </Button>

      {status.type && (
        <div style={{
          padding: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.fontSize.sm,
          backgroundColor: status.type === 'success'
            ? theme.colors.success + '20'
            : status.type === 'error'
            ? theme.colors.error + '20'
            : theme.colors.blue + '20',
          color: status.type === 'success'
            ? theme.colors.success
            : status.type === 'error'
            ? theme.colors.error
            : theme.colors.blue,
          border: `1px solid ${
            status.type === 'success'
              ? theme.colors.success
              : status.type === 'error'
              ? theme.colors.error
              : theme.colors.blue
          }`,
        }}>
          {status.message}
        </div>
      )}
    </div>
  );
}

console.log('Looking for root element...');
const container = document.getElementById('root');
console.log('Root element:', container);

if (container) {
  console.log('Creating React root...');
  const root = createRoot(container);
  console.log('Rendering App...');
  root.render(<App />);
} else {
  console.error('Root element not found!');
}
