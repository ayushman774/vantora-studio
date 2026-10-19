import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2, RefreshCw } from "lucide-react";
import { deleteReference, imageUrl, listReferences, uploadReference, type CharacterReference } from "./characterReferencesApi";

export default function CharacterReferences({ projectId, characterId }: { projectId: string; characterId: string }) {
  const [items, setItems] = useState<CharacterReference[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setItems(await listReferences(projectId, characterId)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load references"); }
  }, [projectId, characterId]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG, or WebP image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Maximum image size is 10 MB."); return; }
    setBusy(true);
    try { await uploadReference(projectId, characterId, file); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  async function remove(item: CharacterReference) {
    if (!window.confirm(`Delete reference image "${item.original_name}"?`)) return;
    setBusy(true);
    try { await deleteReference(projectId, characterId, item.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(false); }
  }
  return <div className="reference-library">
    <div className="reference-heading"><strong>Reference images ({items.length})</strong>
      <div className="projects-actions">
        <button type="button" className="secondary-action" onClick={() => void refresh()} disabled={busy} title="Refresh images"><RefreshCw size={14}/></button>
        <label className="secondary-action reference-upload"><ImagePlus size={15}/> {busy ? "Working…" : "Upload image"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void onFile(e)} disabled={busy} />
        </label>
      </div>
    </div>
    {error && <p className="project-error" role="alert">{error}</p>}
    {items.length === 0 ? <p className="reference-empty">No reference images yet. Upload a test image to begin.</p> :
      <div className="reference-grid">{items.map(item => <div className="reference-tile" key={item.id}>
        <button type="button" className="reference-image-button" onClick={() => setPreview(imageUrl(projectId, characterId, item.id))} title="Preview image">
          <img src={imageUrl(projectId, characterId, item.id)} alt={item.original_name} loading="lazy"/>
        </button>
        <div className="reference-info"><span title={item.original_name}>{item.original_name}</span>
          <button type="button" className="reference-delete" onClick={() => void remove(item)} disabled={busy} title="Delete image"><Trash2 size={14}/></button>
        </div>
      </div>)}</div>}
    {preview && <div className="reference-modal" role="dialog" aria-modal="true" aria-label="Reference image preview" onClick={() => setPreview(null)}>
      <div className="reference-modal-content" onClick={e => e.stopPropagation()}>
        <button type="button" className="secondary-action" onClick={() => setPreview(null)}>Close preview</button>
        <img src={preview} alt="Selected character reference"/>
      </div>
    </div>}
  </div>;
}
