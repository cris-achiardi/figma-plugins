import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import LibraryReleaseDetailModal from './LibraryReleaseDetailModal';
import type { LibraryVersion } from '../../lib/data';

interface Props {
  releases: LibraryVersion[];
  projectId: string;
}

const PAGE_SIZE = 5;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function LibraryReleases({ releases, projectId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const selectedRelease = selectedId ? releases.find(r => r.id === selectedId) : null;
  const shown = releases.slice(0, visible);
  const hasMore = visible < releases.length;

  if (releases.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 16px' }}>
        No releases published yet
      </div>
    );
  }

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        {shown.map(r => (
          <div
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            style={{
              display: 'flex',
              gap: 16,
              padding: 16,
              borderBottom: '1px solid var(--border)',
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ flexShrink: 0, minWidth: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                v{r.version}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {r.bump_type}
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                {r.changelog_message || 'No release notes'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {timeAgo(r.published_at)}
                </span>
                {r.published_by && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    by {r.published_by}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
      {hasMore && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Load more
          </button>
        </div>
      )}

      {selectedRelease && (
        <LibraryReleaseDetailModal
          release={selectedRelease}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
