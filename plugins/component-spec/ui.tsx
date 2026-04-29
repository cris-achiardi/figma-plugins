import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { CodeMessage, SelectionInfo } from './types';

// ── Helpers ─────────────────────────────────────────────

function postMessage(msg: any) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function copyToClipboard(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

function downloadFile(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function countNodes(node: any): number {
  let count = 1;
  if (node?.children && Array.isArray(node.children)) {
    for (const child of node.children) count += countNodes(child);
  }
  return count;
}

// ── Shared Components ───────────────────────────────────

function ProgressBar({ message, percent }: { message: string; percent: number }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{message}</div>
      <div style={{
        height: 4, borderRadius: 2, background: 'var(--bg-active)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2, background: 'var(--accent)',
          width: `${percent}%`, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 6,
      background: '#EF444420', border: '1px solid #EF444440',
      color: 'var(--error)', fontSize: 11, marginBottom: 12,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', color: 'var(--error)',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
        }}
      >
        x
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-heading)' }}>{value}</span>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-heading)',
  fontSize: 12,
  fontWeight: 500,
  transition: 'opacity 0.15s',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: '#000',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--bg-active)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
};

// ── Export Tab ───────────────────────────────────────────

function ExportTab({ selection, error, onClearError }: {
  selection: SelectionInfo | null;
  error: string | null;
  onClearError: () => void;
}) {
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [exportedText, setExportedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset when selection changes
  useEffect(() => {
    setExportedText(null);
    setProgress(null);
    setCopied(false);
    setShowPreview(false);
  }, [selection?.name, selection?.type, selection?.width, selection?.height]);

  // Listen for export messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'export-progress') {
        setProgress({ message: msg.message, percent: msg.percent });
      } else if (msg.type === 'export-complete') {
        setExportedText(msg.text);
        setProgress(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleExport = () => {
    onClearError();
    setExportedText(null);
    setCopied(false);
    setShowPreview(false);
    postMessage({ type: 'export' });
  };

  const handleCopy = () => {
    if (exportedText) {
      copyToClipboard(exportedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    if (exportedText && selection) {
      const safeName = selection.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadFile(exportedText, `${safeName}.txt`);
    }
  };

  // No selection state
  if (!selection) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>&#9654;</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          Select a layer to export
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4 }}>
          Components, frames, groups, or instances
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={onClearError} />}

      {/* Info card */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 12, marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontWeight: 700,
          fontSize: 13, marginBottom: 8, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {selection.name}
        </div>
        <InfoRow label="Type" value={selection.type} />
        <InfoRow label="Size" value={`${selection.width} x ${selection.height}`} />
        <InfoRow label="Children" value={String(selection.childCount)} />
        {selection.variantCount !== null && (
          <InfoRow label="Variants" value={String(selection.variantCount)} />
        )}
      </div>

      {/* Export button */}
      {!exportedText && !progress && (
        <button style={{ ...btnPrimary, width: '100%' }} onClick={handleExport}>
          Export Properties
        </button>
      )}

      {/* Progress */}
      {progress && <ProgressBar message={progress.message} percent={progress.percent} />}

      {/* Export done */}
      {exportedText && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 12, color: 'var(--accent)', fontSize: 11,
          }}>
            <span>&#10003;</span>
            <span>Exported — {formatSize(exportedText.length)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button style={{ ...btnPrimary, flex: 1 }} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button style={{ ...btnSecondary, flex: 1 }} onClick={handleSave}>
              Save as File
            </button>
          </div>

          <button
            style={{
              ...btnBase, width: '100%', background: 'none',
              color: 'var(--text-secondary)', fontSize: 11, padding: '6px 0',
            }}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {showPreview && (
            <pre style={{
              marginTop: 8, padding: 10, background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 10, color: 'var(--text-secondary)',
              overflow: 'auto', maxHeight: 200,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {exportedText}
            </pre>
          )}

          <button
            style={{
              ...btnBase, width: '100%', background: 'none',
              color: 'var(--text-tertiary)', fontSize: 11, marginTop: 8,
              padding: '6px 0',
            }}
            onClick={handleExport}
          >
            Re-export
          </button>
        </div>
      )}
    </div>
  );
}

// ── Import Tab ──────────────────────────────────────────

function ImportTab({ error, onClearError }: {
  error: string | null;
  onClearError: () => void;
}) {
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<any>(null);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [result, setResult] = useState<{ nodeId: string; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Listen for import messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'import-progress') {
        setProgress({ message: msg.message, percent: msg.percent });
      } else if (msg.type === 'import-complete') {
        setResult({ nodeId: msg.nodeId, warnings: msg.warnings });
        setProgress(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const tryParse = (text: string) => {
    setJsonText(text);
    setParseError(null);
    setParsedSnapshot(null);

    if (!text.trim()) return;

    try {
      const obj = JSON.parse(text);
      if (!obj?.document) {
        setParseError('JSON must have a "document" property (JSON_REST_V1 format)');
        return;
      }
      setParsedSnapshot(obj);
    } catch (e: any) {
      setParseError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      tryParse(text);
    };
    reader.readAsText(file);
    // Reset so the same file can be loaded again
    e.target.value = '';
  };

  const handleReconstruct = () => {
    if (!parsedSnapshot) return;
    onClearError();
    setResult(null);
    const name = parsedSnapshot.document?.name || 'Component';
    postMessage({ type: 'import', snapshot: parsedSnapshot, componentName: name });
  };

  const handleReset = () => {
    setJsonText('');
    setParsedSnapshot(null);
    setParseError(null);
    setProgress(null);
    setResult(null);
    onClearError();
  };

  // Done state
  if (result) {
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12, color: 'var(--accent)', fontSize: 12,
          fontFamily: 'var(--font-heading)',
        }}>
          <span>&#10003;</span>
          <span>Reconstruction complete</span>
        </div>

        {result.warnings.length > 0 && (
          <div style={{
            background: '#F59E0B15', border: '1px solid #F59E0B30',
            borderRadius: 6, padding: 10, marginBottom: 12,
          }}>
            <div style={{
              fontSize: 11, color: 'var(--warning)', fontWeight: 500,
              marginBottom: 6, fontFamily: 'var(--font-heading)',
            }}>
              {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
            </div>
            <div style={{ maxHeight: 120, overflow: 'auto' }}>
              {result.warnings.map((w, i) => (
                <div key={i} style={{
                  fontSize: 10, color: 'var(--text-secondary)',
                  padding: '2px 0', lineHeight: 1.4,
                }}>
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        <button style={{ ...btnPrimary, width: '100%' }} onClick={handleReset}>
          Import Another
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={onClearError} />}

      {/* Input area */}
      {!progress && (
        <>
          <textarea
            value={jsonText}
            onChange={e => tryParse(e.target.value)}
            placeholder="Paste JSON_REST_V1 snapshot here..."
            style={{
              width: '100%', height: 160, resize: 'vertical',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: 10,
              color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
              fontSize: 11, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 12 }}>
            <button
              style={{ ...btnSecondary, flex: 1 }}
              onClick={() => fileRef.current?.click()}
            >
              Load from File
            </button>
            {jsonText && (
              <button
                style={{ ...btnBase, background: 'none', color: 'var(--text-tertiary)', fontSize: 11 }}
                onClick={handleReset}
              >
                Clear
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileLoad}
            style={{ display: 'none' }}
          />

          {parseError && (
            <div style={{
              fontSize: 11, color: 'var(--error)', padding: '6px 0',
            }}>
              {parseError}
            </div>
          )}

          {/* Preview card */}
          {parsedSnapshot && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 12, marginBottom: 12,
            }}>
              <div style={{
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                fontSize: 13, marginBottom: 8, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {parsedSnapshot.document?.name || 'Unnamed'}
              </div>
              <InfoRow label="Type" value={parsedSnapshot.document?.type || 'Unknown'} />
              <InfoRow label="Nodes" value={String(countNodes(parsedSnapshot.document))} />
              <InfoRow label="Size" value={formatSize(jsonText.length)} />
            </div>
          )}

          {parsedSnapshot && (
            <button style={{ ...btnPrimary, width: '100%' }} onClick={handleReconstruct}>
              Reconstruct on Canvas
            </button>
          )}
        </>
      )}

      {/* Progress */}
      {progress && <ProgressBar message={progress.message} percent={progress.percent} />}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────

function App() {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Global message listener for selection + errors
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage as CodeMessage;
      if (!msg) return;
      if (msg.type === 'selection-changed') {
        setSelection(msg.info);
        setError(null);
      } else if (msg.type === 'error') {
        setError(msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <ExportTab
          selection={selection}
          error={error}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
