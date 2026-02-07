import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ComponentSummary {
  key: string;
  name: string;
  latestVersion: string;
  status: string;
  thumbnailUrl: string | null;
  updatedAt: string;
  variantCount: number;
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

const statusColors: Record<string, string> = {
  published: '#4ade80',
  draft: '#fbbf24',
  in_review: '#60a5fa',
  approved: '#4ade80',
  deprecated: '#78716c',
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusOpen, setStatusOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('search-slot'));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || c.status === statusFilter)
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

  const statusFilterLabel = statusFilter === 'all' ? 'All statuses' : statusLabels[statusFilter];

  const toolbar = (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div style={{ position: 'relative', flex: 1 }}>
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
      <div ref={statusRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 32px 8px 12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '160px',
            whiteSpace: 'nowrap',
            position: 'relative',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = statusOpen ? 'var(--text-primary)' : 'var(--border)')}
        >
          {statusFilter !== 'all' && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColors[statusFilter],
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontWeight: 500 }}>{statusFilterLabel}</span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: `translateY(-50%) rotate(${statusOpen ? '180deg' : '0deg'})`,
              transition: 'transform 0.15s',
            }}
          >
            <path d="M1 1L5 5L9 1" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {statusOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              minWidth: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {[{ value: 'all', label: 'All statuses', color: undefined }, ...Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
              color: statusColors[value],
            }))].map((opt) => {
              const isSelected = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    background: isSelected ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? 'var(--bg-hover)' : 'transparent')}
                >
                  {opt.color && (
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: opt.color,
                      flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontWeight: isSelected ? 500 : 400 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {portalTarget && createPortal(toolbar, portalTarget)}
      <table className="component-table">
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 16px', height: '410px', verticalAlign: 'middle' }}>
                {search && statusFilter !== 'all'
                  ? <>No matches for &ldquo;{search}&rdquo; in {statusLabels[statusFilter]}</>
                  : search
                  ? <>No matches for &ldquo;{search}&rdquo;</>
                  : statusFilter !== 'all'
                  ? <>No {statusLabels[statusFilter]} components</>
                  : <>No components found</>}
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
                {c.variantCount > 1 && (
                  <span style={{
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                    fontSize: '12px',
                    marginLeft: '8px',
                  }}>
                    {c.variantCount} variants
                  </span>
                )}
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
