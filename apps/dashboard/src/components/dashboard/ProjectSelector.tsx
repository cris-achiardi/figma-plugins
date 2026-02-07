import { useState, useEffect, useRef } from 'react';
import type { Project } from '@plugin/types';

interface Props {
  projects: Project[];
  currentProjectId?: string;
  versions?: Record<string, string | null>;
}

export default function ProjectSelector({ projects, currentProjectId, versions = {} }: Props) {
  const [selected, setSelected] = useState(currentProjectId || projects[0]?.id || '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentProjectId) setSelected(currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSelect(id: string) {
    setSelected(id);
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('project', id);
    window.location.href = url.toString();
  }

  if (projects.length === 0) {
    return <p className="empty-state">No projects found</p>;
  }

  const current = projects.find((p) => p.id === selected);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 32px 8px 12px',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          cursor: 'pointer',
          width: '360px',
          whiteSpace: 'nowrap',
          position: 'relative',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = open ? 'var(--text-primary)' : 'var(--border)')}
      >
        <span style={{ fontWeight: 500 }}>{current?.name || 'Select project'}</span>
        {versions[selected] && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}>
            v{versions[selected]}
          </span>
        )}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: `translateY(-50%) rotate(${open ? '180deg' : '0deg'})`,
            transition: 'transform 0.15s',
          }}
        >
          <path d="M1 1L5 5L9 1" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '4px',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {projects.map((p) => {
            const isSelected = p.id === selected;
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
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
                <span style={{ fontWeight: isSelected ? 500 : 400 }}>{p.name}</span>
                {versions[p.id] && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}>
                    v{versions[p.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
