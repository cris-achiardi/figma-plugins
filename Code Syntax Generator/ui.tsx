import * as React from 'react';
import { createRoot } from 'react-dom/client';

interface Collection {
  id: string;
  name: string;
}

type Platform = 'WEB' | 'iOS' | 'ANDROID';
type NamingConvention = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

function App() {
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
        prefix: prefix.trim()
      }
    }, '*');

    setStatus({
      type: 'processing',
      message: 'Processing variables...'
    });
  };

  const canApply = selectedCollection && Object.values(platforms).some(Boolean);

  return (
    <div>
      <h2>Bulk Code Syntax</h2>

      <label>
        Variable Collection:
        <select
          value={selectedCollection}
          onChange={e => setSelectedCollection(e.target.value)}
        >
          {collections.length === 0 ? (
            <option value="">No collections found</option>
          ) : (
            collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))
          )}
        </select>
      </label>

      <fieldset>
        <legend>Platforms & Naming Conventions</legend>
        {(Object.keys(platforms) as Platform[]).map(platform => (
          <div key={platform} className="platform-option">
            <input
              type="checkbox"
              id={platform}
              checked={platforms[platform]}
              onChange={() => handlePlatformToggle(platform)}
            />
            <label htmlFor={platform} style={{ margin: 0, flex: 1 }}>
              {platform}
            </label>
            {platforms[platform] && (
              <select
                value={conventions[platform]}
                onChange={e => handleConventionChange(
                  platform,
                  e.target.value as NamingConvention
                )}
              >
                <option value="camelCase">camelCase</option>
                <option value="snake_case">snake_case</option>
                <option value="kebab-case">kebab-case</option>
                <option value="PascalCase">PascalCase</option>
              </select>
            )}
          </div>
        ))}
      </fieldset>

      <label>
        Prefix (optional):
        <input
          type="text"
          value={prefix}
          onChange={e => setPrefix(e.target.value)}
          placeholder="e.g., ds"
        />
      </label>

      <button
        onClick={handleApply}
        disabled={!canApply}
      >
        Apply Code Syntax
      </button>

      {status.type && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
