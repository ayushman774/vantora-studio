import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Film, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { Project } from "./projects";
import { createSeason, deleteSeason, listSeasons, updateSeason, createEpisode, deleteEpisode, listEpisodes, updateEpisode, type Season, type Episode } from "./workspaceApi";

type Editor = { kind: "season" | "episode"; seasonId?: string; id?: string; number: number; title: string; text: string };
export default function ProductionWorkspace({ project }: { project: Project }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
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
  function editEpisode(season: Season, ep?: Episode) { setExpanded(x => x.includes(season.id) ? x : [...x, season.id]); setEditor({ kind: "episode", seasonId: season.id, id: ep?.id, number: ep?.number ?? (Math.max(0, ...(episodes[season.id] ?? []).map(x => x.number)) + 1), title: ep?.title ?? "", text: ep?.synopsis ?? "" }); setError(""); }
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
  return <section className="production-workspace"><div className="project-toolbar"><div><div className="eyebrow">PRODUCTION STRUCTURE</div><h2>Seasons & Episodes</h2></div><div className="projects-actions"><button className="secondary-action" onClick={() => void reload()}><RefreshCw size={15}/> Refresh</button><button className="primary-action" onClick={() => editSeason()}><Plus size={16}/> Add season</button></div></div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {editor && <form className="project-form workspace-editor" onSubmit={e => void save(e)}><div className="project-form-heading"><h2>{editor.id ? "Edit" : "New"} {editor.kind}</h2><button className="secondary-action" type="button" onClick={() => setEditor(null)}>Cancel</button></div><label>Number<input type="number" min={1} step={1} required value={editor.number} onChange={e => setEditor({ ...editor, number: Number(e.target.value) })}/></label><label>Title<input required maxLength={160} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })}/></label><label>{editor.kind === "season" ? "Description" : "Synopsis"}<textarea rows={3} maxLength={editor.kind === "season" ? 5000 : 10000} value={editor.text} onChange={e => setEditor({ ...editor, text: e.target.value })}/></label><button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button></form>}
    {loading ? <div className="project-empty">Loading production structure…</div> : seasons.length === 0 ? <div className="project-empty"><Film size={35}/><h2>No seasons yet</h2><p>Create Season 1 to start organizing your episodes.</p><button className="primary-action" onClick={() => editSeason()}><Plus size={16}/> Create Season 1</button></div> : <div className="workspace-seasons">{seasons.map(s => { const open = expanded.includes(s.id); return <article className="workspace-season" key={s.id}><div className="workspace-season-head"><button type="button" className="workspace-expand" onClick={() => setExpanded(x => open ? x.filter(id => id !== s.id) : [...x, s.id])} aria-expanded={open}>{open ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}<span className="workspace-season-number">SEASON {s.number}</span><strong>{s.title}</strong><span className="workspace-count">{(episodes[s.id] ?? []).length} episodes</span></button><div className="projects-actions"><button className="secondary-action icon-action" aria-label={`Edit season ${s.number}`} onClick={() => editSeason(s)}><Pencil size={15}/></button><button className="danger-action icon-action" aria-label={`Delete season ${s.number}`} onClick={() => void removeSeason(s)}><Trash2 size={15}/></button></div></div>{open && <div className="workspace-episodes">{s.description && <p className="workspace-description">{s.description}</p>}{(episodes[s.id] ?? []).map(ep => <div className="workspace-episode" key={ep.id}><Film size={18}/><div className="workspace-episode-info"><strong>Episode {ep.number} · {ep.title}</strong>{ep.synopsis && <p>{ep.synopsis}</p>}</div><button className="secondary-action icon-action" aria-label={`Edit episode ${ep.number}`} onClick={() => editEpisode(s, ep)}><Pencil size={15}/></button><button className="danger-action icon-action" aria-label={`Delete episode ${ep.number}`} onClick={() => void removeEpisode(s, ep)}><Trash2 size={15}/></button></div>)}<button className="secondary-action" onClick={() => editEpisode(s)}><Plus size={16}/> Add episode</button></div>}</article>; })}</div>}
  </section>;
}
