import { useState, useEffect, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { getLibraryVersionComponents, getLibraryVersionChangelog } from '../../lib/data';
import type { LibraryVersion, LibraryVersionComponent, LibraryChangelogEntry } from '../../lib/data';

// ----- Types -----

interface Props {
  release: LibraryVersion;
  projectId: string;
  onClose: () => void;
}

type Tab = 'overview' | 'components';

// ----- Helpers -----

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const changeColors: Record<string, { bg: string; fg: string; prefix: string }> = {
  added: { bg: 'rgba(16,185,129,0.06)', fg: '#10b981', prefix: '+' },
  updated: { bg: 'rgba(245,158,11,0.06)', fg: '#f59e0b', prefix: '~' },
  removed: { bg: 'rgba(239,68,68,0.06)', fg: '#ef4444', prefix: '-' },
};

// ----- Main Component -----

export default function LibraryReleaseDetailModal({ release, projectId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'components', label: 'Components' },
  ];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 720,
        height: '100%',
        maxHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--text-primary)',
            }}>
              v{release.version}
            </span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}>
              {release.bump_type}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px',
              borderRadius: 'var(--radius-sm)', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: activeTab === t.key ? 600 : 400,
                color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === t.key ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (activeTab !== t.key) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (activeTab !== t.key) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="thin-scrollbar" style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {activeTab === 'overview' && <OverviewTab release={release} />}
          {activeTab === 'components' && <ComponentsTab release={release} projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

// ===================== OVERVIEW TAB =====================

function OverviewTab({ release }: { release: LibraryVersion }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Release notes */}
      {release.changelog_message && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 14,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Release Notes
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
            {release.changelog_message}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px 20px',
      }}>
        {[
          { label: 'Published', value: formatDate(release.published_at) },
          { label: 'Published by', value: release.published_by || '--' },
          { label: 'Bump type', value: release.bump_type.toUpperCase() },
          { label: 'Created', value: formatDate(release.created_at) },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== COMPONENTS TAB =====================

function ComponentsTab({ release, projectId }: { release: LibraryVersion; projectId: string }) {
  const [changelog, setChangelog] = useState<LibraryChangelogEntry[] | null>(null);
  const [components, setComponents] = useState<LibraryVersionComponent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [comps, changes] = await Promise.all([
          getLibraryVersionComponents(release.id),
          getLibraryVersionChangelog(release.id, projectId),
        ]);
        if (cancelled) return;
        setComponents(comps);
        setChangelog(changes);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load components');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [release.id, projectId]);

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        Loading components...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#f87171', textAlign: 'center', padding: '48px 16px' }}>
        {error}
      </div>
    );
  }

  // Show changelog if available, otherwise fall back to flat component list
  if (changelog && changelog.length > 0) {
    return (
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 8,
        background: 'var(--bg-primary)',
      }}>
        {changelog.map((c, i) => {
          const colors = changeColors[c.change_type] || changeColors.updated;
          const href = `/dashboard/components/${encodeURIComponent(c.component_key)}?project=${projectId}`;
          return (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '6px 8px',
              background: colors.bg,
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: colors.fg,
                flexShrink: 0,
                lineHeight: '18px',
              }}>
                {colors.prefix}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {c.component_name}
                </span>
                {c.to_version && (
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    v{c.to_version}
                  </span>
                )}
                {c.changelog_message && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: '100%' }}>
                    {c.changelog_message}
                  </span>
                )}
              </div>
              <a
                href={href}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                title={`View ${c.component_name}`}
              >
                <ChevronRight size={14} />
              </a>
            </div>
          );
        })}
      </div>
    );
  }

  // Flat list fallback
  if (!components || components.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        No components in this release
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {components.map((c, i) => (
        <div
          key={c.component_version_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderBottom: i < components.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            {c.component_name}
          </span>
          <a
            href={`/dashboard/components/${encodeURIComponent(c.component_key)}?project=${projectId}`}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 14,
              textDecoration: 'none',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title={`View ${c.component_name}`}
          >
            <ChevronRight size={14} />
          </a>
        </div>
      ))}
    </div>
  );
}
