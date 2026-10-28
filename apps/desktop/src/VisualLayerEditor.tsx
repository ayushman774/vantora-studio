import {useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Layers,Plus,Trash2,Eye,EyeOff,Save} from "lucide-react";
import {assetImageUrl,type Asset} from "./assetsApi";
import LayerTimeline from "./LayerTimeline";
import {interpolateKeyframes} from "./animationInterpolation";
import type {KeyframeScope,KeyframeInput} from "./animationKeyframesApi";
import {listLayerKeyframes,createLayerKeyframe,updateLayerKeyframe,deleteLayerKeyframe,type LayerKeyframe} from "./layerKeyframesApi";
import {
 listVisualLayers,createVisualLayer,updateVisualLayer,deleteVisualLayer,
 type VisualLayer,type VisualLayerInput
} from "./visualLayersApi";

const empty=(asset:Asset,order:number):VisualLayerInput=>({
 asset_id:asset.id,name:asset.title,layer_order:order,
 position_x:0,position_y:0,scale:1,rotation:0,opacity:1,visible:true
});
export default function VisualLayerEditor({scope,assets,frameTitle,holdFrames,onBack}:{
 scope:KeyframeScope;assets:Asset[];frameTitle:string;holdFrames:number;onBack:()=>void
}){
 const [layers,setLayers]=useState<VisualLayer[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [draft,setDraft]=useState<VisualLayerInput|null>(null);
 const [busy,setBusy]=useState(false);
 const [points,setPoints]=useState<LayerKeyframe[]>([]);
 const [timelinePoints,setTimelinePoints]=useState<Record<string,LayerKeyframe[]>>({});
 const [playhead,setPlayhead]=useState(0);
 const [keyDraft,setKeyDraft]=useState<(KeyframeInput&{id?:string})|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const images=assets.filter(asset=>asset.media_type.startsWith("image/"));
 async function refreshTimeline(items:VisualLayer[]){
  const entries=await Promise.all(items.map(async layer=>[layer.id,await listLayerKeyframes(scope,layer.id)] as const));
  setTimelinePoints(Object.fromEntries(entries));
 }
 async function reload(){
  const items=await listVisualLayers(scope);
  setLayers(items);
  await refreshTimeline(items);
  return items;
 }
 useEffect(()=>{
  let active=true;
  setLoading(true);setError("");
  listVisualLayers(scope).then(async items=>{if(active){setLayers(items);await refreshTimeline(items);}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load layers");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[scope.projectId,scope.seasonId,scope.episodeId,scope.sceneId,scope.shotId,scope.frameId]);
 async function loadPoints(id:string){try{const next=await listLayerKeyframes(scope,id);setPoints(next);setTimelinePoints(previous=>({...previous,[id]:next}));}catch(e){setError(e instanceof Error?e.message:"Could not load layer keyframes");}}
 function select(layer:VisualLayer){setSelected(layer.id);setKeyDraft(null);setPoints([]);void loadPoints(layer.id);setDraft({
  asset_id:layer.asset_id,name:layer.name,layer_order:layer.layer_order,
  position_x:layer.position_x,position_y:layer.position_y,scale:layer.scale,
  rotation:layer.rotation,opacity:layer.opacity,visible:layer.visible
 });setError("");}
 function add(){
  if(!images.length){setError("Import an image into the Asset Library first.");return;}
  const next=Math.max(-1,...layers.map(layer=>layer.layer_order))+1;
  setSelected(null);setKeyDraft(null);setPoints([]);setDraft(empty(images[0],next));setError("");
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!draft||busy)return;
  if(!draft.name.trim()){setError("Enter a layer name.");return;}
  setBusy(true);setError("");
  try{
   const item=selected?await updateVisualLayer(scope,selected,draft):await createVisualLayer(scope,draft);
   const items=await reload();
   const updated=items.find(layer=>layer.id===item.id);
   if(updated)select(updated);
  }catch(e){setError(e instanceof Error?e.message:"Could not save layer");}
  finally{setBusy(false);}
 }
 async function remove(){
  if(!selected||busy||!window.confirm("Remove this layer? The original asset will remain in the library."))return;
  setBusy(true);setError("");
  try{await deleteVisualLayer(scope,selected);await reload();setSelected(null);setDraft(null);setPoints([]);}
  catch(e){setError(e instanceof Error?e.message:"Could not delete layer");}
  finally{setBusy(false);}
 }

 function addPoint(){
  if(!selected||!draft)return;
  const used=new Set(points.map(point=>point.frame_offset));
  const offset=Array.from({length:holdFrames},(_,i)=>i).find(i=>!used.has(i));
  if(offset===undefined){setError("Every frame already has a keyframe.");return;}
  setKeyDraft({frame_offset:offset,position_x:draft.position_x,position_y:draft.position_y,scale:draft.scale,rotation:draft.rotation,opacity:draft.opacity,easing:"linear"});
 }
 async function savePoint(e:FormEvent){
  e.preventDefault();if(!selected||!keyDraft||busy)return;
  const {id,...data}=keyDraft;
  if(!Number.isInteger(data.frame_offset)||data.frame_offset<0||data.frame_offset>=holdFrames||data.scale<=0||data.scale>10||data.opacity<0||data.opacity>1||![data.position_x,data.position_y,data.scale,data.rotation,data.opacity].every(Number.isFinite)){setError("Check animation keyframe values.");return;}
  setBusy(true);setError("");
  try{if(id)await updateLayerKeyframe(scope,selected,id,data);else await createLayerKeyframe(scope,selected,data);await loadPoints(selected);setKeyDraft(null);}
  catch(err){setError(err instanceof Error?err.message:"Could not save layer keyframe");}
  finally{setBusy(false);}
 }
 async function removePoint(id:string){
  if(!selected||busy||!window.confirm("Delete this layer keyframe?"))return;
  setBusy(true);setError("");
  try{await deleteLayerKeyframe(scope,selected,id);await loadPoints(selected);setKeyDraft(null);}
  catch(err){setError(err instanceof Error?err.message:"Could not delete layer keyframe");}
  finally{setBusy(false);}
 }
 function numeric(key:"layer_order"|"position_x"|"position_y"|"scale"|"rotation"|"opacity",value:number){
  setDraft(previous=>previous?{...previous,[key]:value}:previous);
 }
 return <section className="vl-workspace">
  <header className="vl-header">
   <div><button className="secondary-action" type="button" onClick={onBack}><ArrowLeft size={15}/> Back to storyboard</button>
    <p className="eyebrow">V0.17 / VISUAL LAYERS</p><h2>{frameTitle}</h2>
    <p>Build a shot with independently positioned image layers. Changes are saved to the local project.</p></div>
   <button className="primary-action" type="button" disabled={loading||busy||!images.length} onClick={add}><Plus size={15}/> Add layer</button>
  </header>
  {error&&<div className="project-error" role="alert">{error}</div>}
  <LayerTimeline layers={layers} keyframes={timelinePoints} holdFrames={holdFrames} playhead={playhead} selectedLayerId={selected}
   onSeek={setPlayhead} onSelectLayer={id=>{const layer=layers.find(item=>item.id===id);if(layer)select(layer);}}
   onSelectKeyframe={(id,point)=>{const layer=layers.find(item=>item.id===id);if(layer)select(layer);setKeyDraft({...point});}}/>
  <div className="vl-layout">
   <section className="vl-stack" aria-label="Visual layer stack">
    <div className="vl-section-heading"><Layers size={17}/><strong>Layer stack</strong><span>{layers.length} layers</span></div>
    {loading?<p>Loading layers…</p>:layers.length===0?<p>No layers yet. Add character or background artwork from your Asset Library.</p>:null}
    {[...layers].reverse().map(layer=><button key={layer.id} type="button"
      className={"vl-stack-item"+(selected===layer.id?" active":"")} onClick={()=>select(layer)}>
      <img src={assetImageUrl(scope.projectId,layer.asset_id)} alt="" loading="lazy"/>
      <span><strong>{layer.name}</strong><small>Layer {layer.layer_order} · {layer.visible?"Visible":"Hidden"}</small></span>
      {layer.visible?<Eye size={16}/>:<EyeOff size={16}/>}
    </button>)}
    {!images.length&&<p className="vl-note">Import PNG, JPEG or WebP images into the Asset Library to begin.</p>}
   </section>
   <section className="vl-inspector" aria-label="Layer inspector">
    <div className="vl-section-heading"><strong>{selected?"Edit layer":"Layer inspector"}</strong></div>
    {!draft?<div className="vl-empty">Select a layer to edit, or add a new layer.</div>:
    <form onSubmit={e=>void save(e)} className="vl-form">
     <div className="vl-preview">{draft.visible?<img src={assetImageUrl(scope.projectId,draft.asset_id)}
       alt="Selected layer artwork" style={(()=>{
        const motion=selected&&timelinePoints[selected]?.length?interpolateKeyframes(timelinePoints[selected],playhead):draft;
        return {transform:`translate(${motion.position_x/8}px,${motion.position_y/8}px) rotate(${motion.rotation}deg) scale(${motion.scale})`,opacity:motion.opacity};
       })()}/>:<span>Layer hidden</span>}</div>
     <label>Name<input required maxLength={160} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
     <label>Image asset<select value={draft.asset_id} onChange={e=>setDraft({...draft,asset_id:e.target.value})}>
      {images.map(asset=><option key={asset.id} value={asset.id}>{asset.title} · {asset.category}</option>)}
     </select></label>
     <div className="vl-fields">
      <label>Stack order<input type="number" min={0} step={1} value={draft.layer_order} onChange={e=>numeric("layer_order",Number(e.target.value))}/></label>
      <label>X position<input type="number" min={-10000} max={10000} value={draft.position_x} onChange={e=>numeric("position_x",Number(e.target.value))}/></label>
      <label>Y position<input type="number" min={-10000} max={10000} value={draft.position_y} onChange={e=>numeric("position_y",Number(e.target.value))}/></label>
      <label>Scale<input type="number" min={0.01} max={10} step="any" value={draft.scale} onChange={e=>numeric("scale",Number(e.target.value))}/></label>
      <label>Rotation (°)<input type="number" min={-3600} max={3600} value={draft.rotation} onChange={e=>numeric("rotation",Number(e.target.value))}/></label>
      <label>Opacity<input type="number" min={0} max={1} step={0.05} value={draft.opacity} onChange={e=>numeric("opacity",Number(e.target.value))}/></label>
     </div>
     <label className="vl-visibility"><input type="checkbox" checked={draft.visible} onChange={e=>setDraft({...draft,visible:e.target.checked})}/> Visible</label>
     <div className="vl-actions"><button className="primary-action" disabled={busy} type="submit"><Save size={15}/>{busy?"Saving…":"Save layer"}</button>
      {selected&&<button className="danger-action" type="button" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> Remove</button>}
     </div>
    </form>}

    {selected&&<section className="ak-panel vl-keyframe-panel">
     <div className="ak-section-head"><div><span className="eyebrow">INDEPENDENT ANIMATION</span><h3>Layer keyframes</h3></div>
      <button type="button" className="secondary-action" disabled={busy||points.length>=holdFrames} onClick={addPoint}><Plus size={14}/> Add keyframe</button></div>
     <p className="vl-note">Animate this layer only. Frame offsets run from 0 to {holdFrames-1} at 24 FPS. Save layer properties before adding keyframes.</p>
     <div className="ak-list">{points.map(point=><article key={point.id} className="ak-item">
      <div className="ak-item-info"><strong>Frame {point.frame_offset}</strong><div className="ak-values"><span>X {point.position_x}, Y {point.position_y}</span><span>{point.scale}× · {point.rotation}° · {Math.round(point.opacity*100)}%</span></div></div>
      <div className="ak-actions"><button type="button" className="secondary-action" disabled={busy} onClick={()=>setKeyDraft({...point})}>Edit</button>
      <button type="button" className="danger-action icon-action" disabled={busy} onClick={()=>void removePoint(point.id)}><Trash2 size={14}/></button></div>
     </article>)}</div>
     {keyDraft&&<form className="ak-form" onSubmit={e=>void savePoint(e)}>
      <div className="vl-keyframe-fields">
       {(["frame_offset","position_x","position_y","scale","rotation","opacity"] as const).map(field=>{
        const labels={frame_offset:"Timeline frame",position_x:"Position X",position_y:"Position Y",scale:"Scale",rotation:"Rotation",opacity:"Opacity"};
        const units={frame_offset:"frame",position_x:"px",position_y:"px",scale:"×",rotation:"°",opacity:"0–1"};
        const inputId="vl-keyframe-"+field;
        return <div className="vl-keyframe-field" key={field}>
         <label htmlFor={inputId}>{labels[field]} <span>{units[field]}</span></label>
         <input id={inputId} required type="number" step={field==="frame_offset"?"1":"any"} min={field==="frame_offset"?0:field==="scale"?0.001:field==="opacity"?0:field==="rotation"?-3600:-10000} max={field==="frame_offset"?holdFrames-1:field==="scale"?10:field==="opacity"?1:field==="rotation"?3600:10000} value={keyDraft[field]} onChange={e=>setKeyDraft(prev=>prev?{...prev,[field]:Number(e.target.value)}:prev)}/>
        </div>;
       })}
      </div>
      <div className="vl-keyframe-field"><label htmlFor="vl-keyframe-easing">Interpolation</label><select id="vl-keyframe-easing" value={keyDraft.easing} onChange={e=>setKeyDraft({...keyDraft,easing:e.target.value as KeyframeInput["easing"]})}>
       <option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in / out</option>
      </select></div>
      <div className="vl-actions vl-keyframe-actions"><button type="submit" className="primary-action" disabled={busy}>Save keyframe</button><button type="button" className="secondary-action" onClick={()=>setKeyDraft(null)}>Cancel</button></div>
     </form>}
    </section>}
   </section>
  </div>
 </section>;
}
