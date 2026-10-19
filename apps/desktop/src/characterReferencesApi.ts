export type CharacterReference = { id: string; character_id: string; original_name: string; media_type: string; size_bytes: number; sha256: string; created_at: string };
const base = (projectId: string, characterId: string) => `http://127.0.0.1:8000/api/v1/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}/references`;
async function checked(response: Response) {
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status})`;
    try { const body = await response.json(); if (typeof body.detail === "string") detail = body.detail; } catch { /* no JSON */ }
    throw new Error(detail);
  }
  return response;
}
export const imageUrl = (projectId: string, characterId: string, id: string) => `${base(projectId, characterId)}/${encodeURIComponent(id)}/image`;
export async function listReferences(projectId: string, characterId: string): Promise<CharacterReference[]> {
  return (await checked(await fetch(base(projectId, characterId)))).json();
}
export async function uploadReference(projectId: string, characterId: string, file: File): Promise<CharacterReference> {
  return (await checked(await fetch(base(projectId, characterId), { method: "POST", headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) }, body: file }))).json();
}
export async function deleteReference(projectId: string, characterId: string, id: string): Promise<void> {
  await checked(await fetch(imageUrl(projectId, characterId, id).replace(/\\/image$/, ""), { method: "DELETE" }));
}
