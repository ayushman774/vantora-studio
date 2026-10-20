import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Film, Plus, Pencil, Trash2, RefreshCw, Layers3, ArrowLeft } from "lucide-react";
import type { Project } from "./projects";
import SceneWorkspace from "./SceneWorkspace";
import { createSeason, deleteSeason, listSeasons, updateSeason, createEpisode, deleteEpisode, listEpisodes, updateEpisode, type Season, type Episode } from "./workspaceApi";

type Editor = { kind: "season" | "episode"; seasonId?: string; id?: string; number: number; title: string; text: string };
export default function ProductionWorkspace({ project }: { project: Project }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeEpisode, setActiveEpisode] = useState<{seasonId:string;episode:Episode}|null>(null);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const items = await listSeasons(project.id);
      const pairs = await Promise.all(items.map(async s => [s.id, await listEpisodes(project.id, s.id)] as const));
      setSeasons(items); setEpisodes(Object.fromEntries(pairs));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load workspace"); }
    finally { setLoading(false); }
  }, [project.id]);
  useEffect(() => { void reload(); }, [reload]);
  function editSeason(s?: Season) { setEditor({ kind: "season", id: s?.id, number: s?.number ?? (Math.max(0, ...seasons.map(x => x.number)) + 1), title: s?.title ?? "", text: s?.description ?? "" }); setError(""); }
  function editEpisode(season: Season, ep?: Episode) { setSelectedSeasonId(season.id); setEditor({ kind: "episode", seasonId: season.id, id: ep?.id, number: ep?.number ?? (Math.max(0, ...(episodes[season.id] ?? []).map(x => x.number)) + 1), title: ep?.title ?? "", text: ep?.synopsis ?? "" }); setError(""); }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!editor || busy) return;
    if (!editor.title.trim() || !Number.isInteger(editor.number) || editor.number < 1) { setError("Enter a title and a positive whole-number position."); return; }
    setBusy(true); setError("");
    try {
      if (editor.kind === "season") {
        const data = { number: editor.number, title: editor.title.trim(), description: editor.text };
        if (editor.id) await updateSeason(project.id, editor.id, data); else await createSeason(project.id, data);
      } else if (editor.seasonId) {
        const data = { number: editor.number, title: editor.title.trim(), synopsis: editor.text };
        if (editor.id) await updateEpisode(project.id, editor.seasonId, editor.id, data); else await createEpisode(project.id, editor.seasonId, data);
      }
      setEditor(null); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function removeSeason(s: Season) {
    if (!window.confirm(`Delete Season ${s.number} and ALL its episodes permanently?`)) return;
    setError(""); try { await deleteSeason(project.id, s.id); setEditor(null); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }
  async function removeEpisode(s: Season, ep: Episode) {
    if (!window.confirm(`Delete Episode ${ep.number}: ${ep.title} permanently?`)) return;
    setError(""); try { await deleteEpisode(project.id, s.id, ep.id); setEditor(null); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) ?? seasons[0];
  if(activeEpisode) return <SceneWorkspace key={activeEpisode.episode.id} projectId={project.id} seasonId={activeEpisode.seasonId} episodeId={activeEpisode.episode.id} episodeTitle={activeEpisode.episode.title} onBack={()=>setActiveEpisode(null)}/>;
  return <section className="production-workspace">
    <div className="project-toolbar"><div><div className="eyebrow">PRODUCTION STRUCTURE</div><h2>Seasons & Episodes</h2></div><div className="projects-actions"><button className="secondary-action" onClick={() => void reload()} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="primary-action" onClick={() => editSeason()}><Plus size={16}/> Add season</button></div></div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {editor && <div className="workspace-editor-backdrop" role="presentation"><form className="project-form workspace-editor cinematic-editor" onSubmit={e => void save(e)}>
      <div className="project-form-heading"><h2>{editor.id ? "Edit" : "New"} {editor.kind}</h2><button className="secondary-action" type="button" onClick={() => setEditor(null)} disabled={busy}><ArrowLeft size={15}/> Cancel</button></div>
      <label>Number<input autoFocus type="number" min={1} step={1} required value={editor.number} onChange={e => setEditor({ ...editor, number: Number(e.target.value) })}/></label>
      <label>Title<input required maxLength={160} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })}/></label>
      <label>{editor.kind === "season" ? "Description" : "Synopsis"}<textarea rows={5} maxLength={editor.kind === "season" ? 5000 : 10000} value={editor.text} onChange={e => setEditor({ ...editor, text: e.target.value })}/></label>
      <button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form></div>}
    {loading ? <div className="project-empty">Loading production structure…</div> : seasons.length === 0 ? <div className="project-empty"><Film size={35}/><h2>No seasons yet</h2><p>Create Season 1 to start organizing your episodes.</p><button className="primary-action" onClick={() => editSeason()}><Plus size={16}/> Create Season 1</button></div> :
    <div className="cinematic-production-layout">
      <aside className="cinematic-season-list" aria-label="Seasons">
        <div className="cinematic-panel-label"><Layers3 size={16}/> Seasons <span>{seasons.length}</span></div>
        {seasons.map(s => <button type="button" key={s.id} className={selectedSeason?.id === s.id ? "cinematic-season-item active" : "cinematic-season-item"} onClick={() => setSelectedSeasonId(s.id)}>
          <span className="cinematic-season-index">S{s.number}</span><span className="cinematic-season-name"><strong>{s.title}</strong><small>{(episodes[s.id] ?? []).length} episodes</small></span>
        </button>)}
      </aside>
      <div className="cinematic-episode-panel">
        {selectedSeason && <><div className="cinematic-episode-header"><div><span className="project-type">SEASON {selectedSeason.number}</span><h3>{selectedSeason.title}</h3>{selectedSeason.description && <p>{selectedSeason.description}</p>}</div>
          <div className="projects-actions"><button className="secondary-action icon-action" aria-label="Edit season" onClick={() => editSeason(selectedSeason)}><Pencil size={15}/></button><button className="danger-action icon-action" aria-label="Delete season" onClick={() => void removeSeason(selectedSeason)}><Trash2 size={15}/></button></div></div>
          <div className="cinematic-episode-toolbar"><strong>Episodes <span>{(episodes[selectedSeason.id] ?? []).length}</span></strong><button className="primary-action" onClick={() => editEpisode(selectedSeason)}><Plus size={16}/> Add episode</button></div>
          <div className="cinematic-episode-list">{(episodes[selectedSeason.id] ?? []).length === 0 ? <div className="cinematic-episode-empty">No episodes in this season yet.</div> : (episodes[selectedSeason.id] ?? []).map(ep => <article className="cinematic-episode-row" key={ep.id}><div className="cinematic-episode-number">{String(ep.number).padStart(2,"0")}</div><div className="workspace-episode-info"><strong>{ep.title}</strong>{ep.synopsis && <p>{ep.synopsis}</p>}</div><button className="secondary-action" onClick={() => setActiveEpisode({seasonId:selectedSeason.id,episode:ep})}><Film size={15}/> Scenes & Shots</button><button className="secondary-action icon-action" aria-label={`Edit episode ${ep.number}`} onClick={() => editEpisode(selectedSeason, ep)}><Pencil size={15}/></button><button className="danger-action icon-action" aria-label={`Delete episode ${ep.number}`} onClick={() => void removeEpisode(selectedSeason, ep)}><Trash2 size={15}/></button></article>)}</div>
        </>}
      </div>
    </div>}
  </section>;
}
