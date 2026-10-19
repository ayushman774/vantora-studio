export type AssetCategory = "concept" | "background" | "character" | "prop" | "other";
export type Asset = { id: string; project_id: string; category: AssetCategory; character_id: string | null; title: string; original_name: string; media_type: string; size_bytes: number; sha256: string; created_at: string };
export const assetCategories: AssetCategory[] = ["concept", "background", "character", "prop", "other"];
const base = (projectId: string) => `http://127.0.0.1:8000/api/v1/projects/${encodeURIComponent(projectId)}/assets`;
async function checked(response: Response) {
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status})`;
    try { const body = await response.json(); if (typeof body.detail === "string") detail = body.detail; } catch { /* fallback */ }
    throw new Error(detail);
  }
  return response;
}
export const assetImageUrl = (projectId: string, id: string) => `${base(projectId)}/${encodeURIComponent(id)}/image`;
export async function listAssets(projectId: string): Promise<Asset[]> {
  return (await checked(await fetch(base(projectId)))).json();
}
export async function uploadAsset(projectId: string, file: File, category: AssetCategory): Promise<Asset> {
  return (await checked(await fetch(`${base(projectId)}?category=${encodeURIComponent(category)}`, { method: "POST", headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) }, body: file }))).json();
}
export async function updateAsset(projectId: string, id: string, data: Partial<Pick<Asset,"title"|"category"|"character_id">>): Promise<Asset> {
  return (await checked(await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }))).json();
}
export async function deleteAsset(projectId: string, id: string): Promise<void> {
  await checked(await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
