import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ComponentSummary {
  key: string;
  name: string;
  latestVersion: string;
  status: string;
  thumbnailUrl: string | null;
  updatedAt: string;
}

interface Props {
  components: ComponentSummary[];
  projectId: string;
}

type SortField = 'name' | 'status' | 'updatedAt';

const statusLabels: Record<string, string> = {
  published: 'published',
  draft: 'draft',
  in_review: 'in review',
  approved: 'approved',
  deprecated: 'deprecated',
};

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

export default function ComponentTable({ components, projectId }: Props) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('search-slot'));
  }, []);

  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
    else cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return '';
    return sortAsc ? ' \u2191' : ' \u2193';
  }

  if (components.length === 0) {
    return <div className="empty-state">No components tracked yet</div>;
  }

  const searchInput = (
    <div style={{ position: 'relative' }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px 8px 34px',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          outline: 'none',
        }}
      />
    </div>
  );

  return (
    <>
      {portalTarget && createPortal(searchInput, portalTarget)}
      <table className="component-table">
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 16px' }}>
                No matches for &ldquo;{search}&rdquo;
              </td>
            </tr>
          )}
          {sorted.map((c) => (
            <tr
              key={c.key}
              onClick={() => {
                window.location.href = `/dashboard/components/${encodeURIComponent(c.key)}?project=${projectId}`;
              }}
            >
              <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {c.name}
              </td>
              <td>
                <span className={`status-pill status-pill--${c.status}`}>
                  {statusLabels[c.status] || c.status}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)' }}>
                {timeAgo(c.updatedAt)}
              </td>
              <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                {c.latestVersion}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
