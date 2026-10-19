import { useCallback, useEffect, useState } from "react";
import { Images, RefreshCw, X } from "lucide-react";
import { assetImageUrl, listAssets, type Asset } from "./assetsApi";

export default function CharacterAssets({ projectId, characterId }: { projectId: string; characterId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listAssets(projectId);
      setAssets(items.filter(item => item.character_id === characterId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load linked assets");
    } finally {
      setLoading(false);
    }
  }, [projectId, characterId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!preview) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [preview]);
  return <section className="character-assets">
    <div className="character-assets-heading">
      <div><h4>Linked production assets</h4><p>Images associated with this character in the project Asset Library.</p></div>
      <button className="secondary-action" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {loading ? <div className="project-empty">Loading linked assets…</div> :
      assets.length === 0 ? <div className="reference-empty-state"><Images size={26}/><strong>No linked assets yet</strong><span>Open Assets, edit a project image, and choose this character under Linked character.</span></div> :
      <div className="character-assets-grid">{assets.map(asset => <button className="character-asset-card" key={asset.id} type="button" onClick={() => setPreview(asset)} aria-label={`Preview ${asset.title}`}>
        <img src={assetImageUrl(projectId, asset.id)} alt="" loading="lazy"/>
        <span><strong>{asset.title}</strong><small>{asset.category}</small></span>
      </button>)}</div>}
    {preview && <div className="asset-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Preview ${preview.title}`} onClick={() => setPreview(null)}>
      <div className="asset-preview" onClick={e => e.stopPropagation()}>
        <div className="project-form-heading"><strong>{preview.title}</strong><button type="button" className="secondary-action" onClick={() => setPreview(null)}><X size={16}/> Close</button></div>
        <img src={assetImageUrl(projectId, preview.id)} alt={preview.title}/>
      </div>
    </div>}
  </section>;
}
