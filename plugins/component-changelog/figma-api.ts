import type { FigmaUser, LibraryInfo, LibraryComponent } from './types';

const BASE = 'https://api.figma.com/v1';

async function figmaFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getMe(token: string): Promise<FigmaUser> {
  const data = await figmaFetch('/me', token);
  return {
    id: data.id,
    name: data.handle || data.email || 'unknown',
    email: data.email || '',
  };
}

export async function getFileInfo(fileKey: string, token: string): Promise<{ name: string }> {
  const data = await figmaFetch(`/files/${fileKey}?depth=1`, token);
  return { name: data.name };
}

export async function getFileComponents(
  fileKey: string,
  token: string
): Promise<LibraryComponent[]> {
  const data = await figmaFetch(`/files/${fileKey}/components`, token);

  if (!data.meta?.components) return [];

  return data.meta.components.map((c: any) => ({
    key: c.key,
    name: c.name,
    description: c.description || '',
    nodeId: c.node_id,
    thumbnailUrl: c.thumbnail_url || '',
    componentSetId: c.containing_frame?.containingComponentSet?.nodeId || null,
    componentSetName: c.containing_frame?.containingComponentSet?.name || null,
  }));
}

export async function getLibraryInfo(
  fileKey: string,
  token: string
): Promise<LibraryInfo> {
  const [fileInfo, components] = await Promise.all([
    getFileInfo(fileKey, token),
    getFileComponents(fileKey, token),
  ]);

  return {
    fileKey,
    name: fileInfo.name,
    componentCount: components.length,
  };
}
