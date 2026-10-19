import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, FolderOpen, Pencil, Plus, RefreshCw, Trash2, LayoutDashboard, Clapperboard, Users, MoreHorizontal } from "lucide-react";
import { createProject, deleteProject, listProjects, updateProject, type Project, type ProjectInput } from "./projects";
import ProductionWorkspace from "./ProductionWorkspace";
import CharacterLibrary from "./CharacterLibrary";

const empty: ProjectInput = { name: "", description: "", project_type: "anime" };
export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"summary" | "seasons" | "characters">("summary");
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectInput>(empty);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setProjects(await listProjects()); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load projects"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  function startCreate() { setEditing(null); setForm(empty); setShowForm(true); setError(""); }
  function startEdit(project: Project) { setEditing(project); setForm({ name: project.name, description: project.description, project_type: project.project_type }); setShowForm(true); setError(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!form.name.trim()) { setError("Enter a project name."); return; }
    setSaving(true); setError("");
    try {
      const saved = editing ? await updateProject(editing.id, { ...form, name: form.name.trim() }) : await createProject({ ...form, name: form.name.trim() });
      setShowForm(false); setSelected(saved.id); setWorkspaceTab("summary"); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save project"); }
    finally { setSaving(false); }
  }
  async function remove(project: Project) {
    if (!window.confirm(`Permanently delete "${project.name}"? This cannot be undone.`)) return;
    setError("");
    try { await deleteProject(project.id); if (selected === project.id) setSelected(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete project"); }
  }
  const active = projects.find(project => project.id === selected);
  return <div className="projects-view">
    <div className="projects-heading"><div><div className="eyebrow">YOUR CREATIVE LIBRARY</div><h1>{active ? active.name : "Projects"}</h1><p className="intro">{active ? "Your project is saved locally and ready for future production tools." : "Every world begins with a project. Create and organize your productions here."}</p></div><div className="projects-actions">{active && <button className="secondary-action" onClick={() => setSelected(null)}><ArrowLeft size={16}/> All projects</button>}<button className="primary-action" onClick={startCreate}><Plus size={17}/> New project</button></div></div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {showForm && <form className="project-form" onSubmit={submit}><div className="project-form-heading"><h2>{editing ? "Edit project" : "Create project"}</h2><button type="button" className="secondary-action" onClick={() => setShowForm(false)}>Cancel</button></div><label>Project name<input autoFocus required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Abyssal Throne" /></label><label>Production type<select value={form.project_type} onChange={e => setForm({ ...form, project_type: e.target.value as ProjectInput["project_type"] })}><option value="anime">Anime</option><option value="film">Film</option><option value="series">Series</option><option value="other">Other</option></select></label><label>Description<textarea maxLength={5000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What story will you tell?" /></label><button className="primary-action" disabled={saving} type="submit">{saving ? "Saving…" : editing ? "Save changes" : "Create project"}</button></form>}
    {loading ? <div className="project-empty">Loading projects…</div> : active ? <section className="cinematic-workspace">
      <div className="cinematic-project-header">
        <div><span className="project-type">{active.project_type.toUpperCase()} PROJECT</span><h2>{active.name}</h2><p>{active.description || "No description yet."}</p></div>
        <div className="projects-actions"><button className="secondary-action" onClick={() => startEdit(active)}><Pencil size={15}/> Edit</button><details className="project-menu"><summary aria-label="More project actions"><MoreHorizontal size={19}/></summary><button className="danger-action" onClick={() => void remove(active)}><Trash2 size={15}/> Delete project</button></details></div>
      </div>
      <nav className="workspace-tabs" aria-label="Project sections">
        {([{id:"summary",label:"Overview",icon:LayoutDashboard},{id:"seasons",label:"Seasons & Episodes",icon:Clapperboard},{id:"characters",label:"Characters & References",icon:Users}] as const).map(tab => <button key={tab.id} type="button" className={workspaceTab===tab.id?"workspace-tab active":"workspace-tab"} aria-current={workspaceTab===tab.id?"page":undefined} onClick={()=>setWorkspaceTab(tab.id)}><tab.icon size={17}/>{tab.label}</button>)}
      </nav>
      <div className="workspace-tab-body">
        {workspaceTab==="summary" && <div className="workspace-summary">
          <div className="workspace-summary-card"><span>Production</span><h3>Seasons & Episodes</h3><p>Organize your story into seasons and episodes.</p><button className="secondary-action" onClick={()=>setWorkspaceTab("seasons")}>Open production →</button></div>
          <div className="workspace-summary-card"><span>Character library</span><h3>Characters & References</h3><p>Manage character profiles and uploaded visual references.</p><button className="secondary-action" onClick={()=>setWorkspaceTab("characters")}>Open characters →</button></div>
          <div className="workspace-summary-meta">Created {new Date(active.created_at).toLocaleString()} · Updated {new Date(active.updated_at).toLocaleString()}</div>
        </div>}
        {workspaceTab==="seasons" && <ProductionWorkspace project={active}/>}
        {workspaceTab==="characters" && <CharacterLibrary project={active}/>}
      </div>
    </section> : projects.length === 0 ? <section className="project-empty"><FolderOpen size={38}/><h2>No projects yet</h2><p>Create your first project to start building your production library.</p><button className="primary-action" onClick={startCreate}><Plus size={17}/> Create first project</button></section> : <><div className="project-toolbar"><span>{projects.length} {projects.length === 1 ? "project" : "projects"} stored locally</span><button className="secondary-action" onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button></div><div className="project-grid">{projects.map(project => <article className="project-tile" key={project.id}><div className="project-tile-icon"><FolderOpen size={25}/></div><span className="project-type">{project.project_type.toUpperCase()}</span><h2>{project.name}</h2><p>{project.description || "No description yet."}</p><div className="project-meta">Updated {new Date(project.updated_at).toLocaleDateString()}</div><div className="projects-actions"><button className="primary-action" onClick={() => { setSelected(project.id); setWorkspaceTab("summary"); }}>Open project</button><button className="secondary-action icon-action" aria-label={`Edit ${project.name}`} onClick={() => startEdit(project)}><Pencil size={16}/></button><button className="danger-action icon-action" aria-label={`Delete ${project.name}`} onClick={() => void remove(project)}><Trash2 size={16}/></button></div></article>)}</div></>}
  </div>;
}
