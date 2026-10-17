export type CharacterInput = {
  name: string;
  role: string;
  biography: string;
  personality: string;
  appearance: string;
  continuity_notes: string;
};
export type Character = CharacterInput & {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
};
const base = "http://127.0.0.1:8000/api/v1/projects";
const collection = (projectId: string) => `${base}/${encodeURIComponent(projectId)}/characters`;
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new Error("Cannot reach the local backend. Start FastAPI and try again.");
  }
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`;
    try {
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
        message = data.detail;
      }
    } catch { /* keep fallback */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const listCharacters = (projectId: string) => request<Character[]>(collection(projectId));
export const createCharacter = (projectId: string, data: CharacterInput) =>
  request<Character>(collection(projectId), { method: "POST", body: JSON.stringify(data) });
export const updateCharacter = (projectId: string, characterId: string, data: Partial<CharacterInput>) =>
  request<Character>(`${collection(projectId)}/${encodeURIComponent(characterId)}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteCharacter = (projectId: string, characterId: string) =>
  request<void>(`${collection(projectId)}/${encodeURIComponent(characterId)}`, { method: "DELETE" });
