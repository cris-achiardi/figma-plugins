import { useState, useEffect } from 'react';
import type { Project } from '@plugin/types';

interface Props {
  projects: Project[];
  currentProjectId?: string;
}

export default function ProjectSelector({ projects, currentProjectId }: Props) {
  const [selected, setSelected] = useState(currentProjectId || projects[0]?.id || '');

  useEffect(() => {
    if (currentProjectId) setSelected(currentProjectId);
  }, [currentProjectId]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelected(id);
    // Navigate with query param
    const url = new URL(window.location.href);
    url.searchParams.set('project', id);
    window.location.href = url.toString();
  }

  if (projects.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No projects found</p>;
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      style={{
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.5rem 1rem',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        cursor: 'pointer',
        minWidth: '200px',
      }}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
