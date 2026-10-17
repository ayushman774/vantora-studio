export type Season = { id: string; project_id: string; number: number; title: string; description: string; created_at: string; updated_at: string };
export type Episode = { id: string; season_id: string; number: number; title: string; synopsis: string; created_at: string; updated_at: string };
export type SeasonInput = Pick<Season, "number" | "title" | "description">;
export type EpisodeInput = Pick<Episode, "number" | "title" | "synopsis">;
const root = "http://127.0.0.1:8000/api/v1/projects";
async function request<T>(path: string, method = "GET", data?: object): Promise<T> {
  let response: Response;
  try { response = await fetch(root + path, { method, headers: { "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) }); }
  catch { throw new Error("Local backend unavailable. Start FastAPI and retry."); }
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status})`;
    try { const body: unknown = await response.json(); if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") detail = body.detail; } catch { /* keep HTTP status */ }
    throw new Error(detail);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
const projectPath = (projectId: string) => `/${encodeURIComponent(projectId)}`;
const seasonPath = (projectId: string, seasonId: string) => `${projectPath(projectId)}/seasons/${encodeURIComponent(seasonId)}`;
const episodePath = (projectId: string, seasonId: string, episodeId: string) => `${seasonPath(projectId, seasonId)}/episodes/${encodeURIComponent(episodeId)}`;
export const listSeasons = (projectId: string) => request<Season[]>(projectPath(projectId) + "/seasons");
export const createSeason = (projectId: string, data: SeasonInput) => request<Season>(projectPath(projectId) + "/seasons", "POST", data);
export const updateSeason = (projectId: string, seasonId: string, data: Partial<SeasonInput>) => request<Season>(seasonPath(projectId, seasonId), "PATCH", data);
export const deleteSeason = (projectId: string, seasonId: string) => request<void>(seasonPath(projectId, seasonId), "DELETE");
export const listEpisodes = (projectId: string, seasonId: string) => request<Episode[]>(seasonPath(projectId, seasonId) + "/episodes");
export const createEpisode = (projectId: string, seasonId: string, data: EpisodeInput) => request<Episode>(seasonPath(projectId, seasonId) + "/episodes", "POST", data);
export const updateEpisode = (projectId: string, seasonId: string, episodeId: string, data: Partial<EpisodeInput>) => request<Episode>(episodePath(projectId, seasonId, episodeId), "PATCH", data);
export const deleteEpisode = (projectId: string, seasonId: string, episodeId: string) => request<void>(episodePath(projectId, seasonId, episodeId), "DELETE");
