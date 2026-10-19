import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { FolderOpen, ImagePlus, Pencil, RefreshCw, Trash2, X, Images } from "lucide-react";
import { listProjects, type Project } from "./projects";
import { assetCategories, assetImageUrl, deleteAsset, listAssets, updateAsset, uploadAsset, type Asset, type AssetCategory } from "./assetsApi";

const label = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);
export default function AssetLibrary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<"all" | AssetCategory>("all");
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>("concept");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AssetCategory>("other");
  useEffect(() => {
    let active = true;
    listProjects().then(data => { if (active) { setProjects(data); setProjectId(id => id && data.some(p => p.id === id) ? id : (data[0]?.id ?? "")); } }).catch(e => { if (active) { setError(e instanceof Error ? e.message : "Unable to load projects"); setLoading(false); } });
    return () => { active = false; };
  }, []);
  const refresh = useCallback(async () => {
    if (!projectId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try { setItems(await listAssets(projectId)); setError(""); }
    catch(e) { setError(e instanceof Error ? e.message : "Unable to load assets"); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setPreview(null); setEditing(null); }, [projectId]);
  useEffect(() => {
    if (!preview) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [preview]);
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !projectId || busy) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be 10 MB or smaller."); return; }
    setBusy(true);
    try { await uploadAsset(projectId, file, uploadCategory); await refresh(); }
    catch(err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  function edit(asset: Asset) { setEditing(asset); setTitle(asset.title); setCategory(asset.category); setError(""); }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    if (!title.trim()) { setError("Enter an asset title."); return; }
    setBusy(true);
    try { await updateAsset(projectId, editing.id, { title: title.trim(), category }); setEditing(null); await refresh(); }
    catch(err) { setError(err instanceof Error ? err.message : "Update failed"); }
    finally { setBusy(false); }
  }
  async function remove(asset: Asset) {
    if (busy || !window.confirm(`Permanently delete "${asset.title}" from this project?`)) return;
    setBusy(true);
    try { await deleteAsset(projectId, asset.id); if (preview?.id === asset.id) setPreview(null); await refresh(); }
    catch(err) { setError(err instanceof Error ? err.message : "Delete failed"); }
    finally { setBusy(false); }
  }
  const visible = items.filter(item => (filter === "all" || item.category === filter) && (item.title.toLowerCase().includes(search.toLowerCase()) || item.original_name.toLowerCase().includes(search.toLowerCase())));
  return <section className="asset-library">
    <div className="projects-heading asset-heading"><div><div className="eyebrow">LOCAL PRODUCTION ASSETS</div><h1>Asset Library</h1><p className="intro">Organize visual assets by project. Files stay on this computer.</p></div><button className="secondary-action" type="button" onClick={() => void refresh()} disabled={loading || !projectId}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="project-error" role="alert">{error}</div>}
    <div className="asset-controls">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!projects.length}>{projects.length === 0 && <option value="">No projects</option>}{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Category<select value={filter} onChange={e => setFilter(e.target.value as "all" | AssetCategory)}><option value="all">All categories</option>{assetCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label className="asset-search">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an asset…" /></label>
    </div>
    <div className="asset-uploadbar"><div><strong>{visible.length} assets</strong><span>PNG, JPEG, WebP · Maximum 10 MB</span></div><div className="projects-actions"><select aria-label="Upload category" value={uploadCategory} onChange={e => setUploadCategory(e.target.value as AssetCategory)}>{assetCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}</select><label className={projectId && !busy ? "primary-action asset-upload" : "primary-action asset-upload disabled"}><ImagePlus size={16}/>{busy ? "Working…" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!projectId || busy} onChange={e => void upload(e)}/></label></div></div>
    {loading ? <div className="project-empty">Loading assets…</div> : !projectId ? <div className="project-empty"><FolderOpen size={36}/><h2>No project available</h2><p>Create a project first, then return to upload assets.</p></div> : items.length === 0 ? <div className="project-empty"><Images size={36}/><h2>No assets yet</h2><p>Upload a test image to start building your project's visual library.</p></div> : visible.length === 0 ? <div className="project-empty">No assets match the selected filters.</div> : <div className="asset-grid">{visible.map(asset => <article className="asset-card" key={asset.id}><button type="button" className="asset-thumb" onClick={() => setPreview(asset)} aria-label={`Preview ${asset.title}`}><img src={assetImageUrl(projectId,asset.id)} alt={asset.title} loading="lazy"/></button><div className="asset-card-info"><span className="project-type">{label(asset.category)}</span><strong title={asset.title}>{asset.title}</strong><small>{(asset.size_bytes/1024/1024).toFixed(2)} MB</small><div className="projects-actions"><button className="secondary-action icon-action" type="button" aria-label={`Edit ${asset.title}`} onClick={() => edit(asset)}><Pencil size={15}/></button><button className="danger-action icon-action" type="button" aria-label={`Delete ${asset.title}`} disabled={busy} onClick={() => void remove(asset)}><Trash2 size={15}/></button></div></div></article>)}</div>}
    {editing && <div className="asset-modal-backdrop"><form className="project-form asset-editor" onSubmit={e => void save(e)}><div className="project-form-heading"><h2>Edit asset</h2><button className="secondary-action" type="button" onClick={() => setEditing(null)}><X size={16}/> Cancel</button></div><label>Title<input required maxLength={160} autoFocus value={title} onChange={e => setTitle(e.target.value)}/></label><label>Category<select value={category} onChange={e => setCategory(e.target.value as AssetCategory)}>{assetCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label><button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></form></div>}
    {preview && <div className="asset-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Preview ${preview.title}`} onClick={() => setPreview(null)}><div className="asset-preview" onClick={e => e.stopPropagation()}><div className="project-form-heading"><strong>{preview.title}</strong><button type="button" className="secondary-action" onClick={() => setPreview(null)}><X size={16}/> Close</button></div><img src={assetImageUrl(projectId,preview.id)} alt={preview.title}/></div></div>}
  </section>;
}
