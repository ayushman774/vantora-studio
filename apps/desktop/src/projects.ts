export type ProjectType = "anime" | "film" | "series" | "other";
export type Project = { id: string; name: string; description: string; project_type: ProjectType; created_at: string; updated_at: string };
export type ProjectInput = { name: string; description: string; project_type: ProjectType };
const base = "http://127.0.0.1:8000/api/v1/projects";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); }
  catch { throw new Error("Cannot reach the local backend. Start FastAPI and try again."); }
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`;
    try { const data = await response.json(); if (typeof data.detail === "string") message = data.detail; }
    catch { /* preserve fallback */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const listProjects = () => request<Project[]>(base);
export const createProject = (data: ProjectInput) => request<Project>(base, { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<ProjectInput>) => request<Project>(`${base}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteProject = (id: string) => request<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
