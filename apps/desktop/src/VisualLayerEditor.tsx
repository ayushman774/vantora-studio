import {useEffect,useState,useRef,type FormEvent} from "react";
import {ArrowLeft,Layers,Plus,Trash2,Eye,EyeOff,Save,Undo2,Redo2} from "lucide-react";
import {assetImageUrl,type Asset} from "./assetsApi";
import LayerTimeline from "./LayerTimeline";
import DraggableLayerPreview from "./DraggableLayerPreview";
import {interpolateKeyframes} from "./animationInterpolation";
import {buildMotionPreset,type MotionPreset} from "./motionPresets";
import type {KeyframeScope,KeyframeInput} from "./animationKeyframesApi";
import {listLayerKeyframes,createLayerKeyframe,updateLayerKeyframe,deleteLayerKeyframe,type LayerKeyframe} from "./layerKeyframesApi";
import {
 listVisualLayers,createVisualLayer,updateVisualLayer,deleteVisualLayer,
 type VisualLayer,type VisualLayerInput
} from "./visualLayersApi";

type HistoryAction=
 |{kind:"move";layerId:string;keyframeId:string;before:number;after:number}
 |{kind:"position";layerId:string;frame:number;before:{x:number;y:number}|null;after:{x:number;y:number};snapshot:KeyframeInput};
const HISTORY_LIMIT=40;
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
 const undoStack=useRef<HistoryAction[]>([]);
 const redoStack=useRef<HistoryAction[]>([]);
 const [historyVersion,setHistoryVersion]=useState(0);
 const historyScope=useRef("");
 const scopeKey=[scope.projectId,scope.seasonId,scope.episodeId,scope.sceneId,scope.shotId,scope.frameId].join("/");
 if(historyScope.current!==scopeKey){historyScope.current=scopeKey;undoStack.current=[];redoStack.current=[];}
 function clearHistory(){undoStack.current=[];redoStack.current=[];setHistoryVersion(v=>v+1);}
 function record(action:HistoryAction){
  undoStack.current=[...undoStack.current,action].slice(-HISTORY_LIMIT);
  redoStack.current=[];setHistoryVersion(v=>v+1);
 }
 async function syncHistoryLayer(layerId:string){
  const updated=await listLayerKeyframes(scope,layerId);
  setTimelinePoints(previous=>({...previous,[layerId]:updated}));
  if(selected===layerId){setPoints(updated);setKeyDraft(null);}
 }
 async function applyHistory(action:HistoryAction,undo:boolean){
  const existing=await listLayerKeyframes(scope,action.layerId);
  if(action.kind==="move"){
   const point=existing.find(item=>item.id===action.keyframeId);
   if(!point)throw new Error("Keyframe no longer exists. Undo history was cleared.");
   const target=undo?action.before:action.after;
   if(existing.some(item=>item.id!==point.id&&item.frame_offset===target))throw new Error("Target frame is occupied. Undo history was cleared.");
   await updateLayerKeyframe(scope,action.layerId,point.id,{frame_offset:target});
   setPlayhead(target);
  }else{
   const point=existing.find(item=>item.frame_offset===action.frame);
   const target=undo?action.before:action.after;
   if(target===null){
    if(point)await deleteLayerKeyframe(scope,action.layerId,point.id);
   }else if(point){
    await updateLayerKeyframe(scope,action.layerId,point.id,{position_x:target.x,position_y:target.y});
   }else{
    await createLayerKeyframe(scope,action.layerId,{...action.snapshot,frame_offset:action.frame,position_x:target.x,position_y:target.y});
   }
   setPlayhead(action.frame);
  }
  await syncHistoryLayer(action.layerId);
 }
 async function historyStep(undo:boolean){
  if(busy)return;
  const source=undo?undoStack:redoStack,destination=undo?redoStack:undoStack;
  const action=source.current[source.current.length-1];if(!action)return;
  setBusy(true);setError("");
  try{
   await applyHistory(action,undo);
   source.current=source.current.slice(0,-1);
   destination.current=[...destination.current,action].slice(-HISTORY_LIMIT);
   setHistoryVersion(v=>v+1);
  }catch(err){
   undoStack.current=[];redoStack.current=[];setHistoryVersion(v=>v+1);
   setError(err instanceof Error?err.message:"Undo/redo failed. History was cleared.");
   try{await syncHistoryLayer(action.layerId);}catch{/* retain original error */}
  }finally{setBusy(false);}
 }
 void historyVersion;
 const [points,setPoints]=useState<LayerKeyframe[]>([]);
 const [timelinePoints,setTimelinePoints]=useState<Record<string,LayerKeyframe[]>>({});
 const [playhead,setPlayhead]=useState(0);
 const [preset,setPreset]=useState<MotionPreset>("slide-in");
 const [presetStart,setPresetStart]=useState(0);
 const [presetEnd,setPresetEnd]=useState(Math.max(1,holdFrames-1));
 const [keyDraft,setKeyDraft]=useState<(KeyframeInput&{id?:string})|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
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
   clearHistory();
  }catch(e){setError(e instanceof Error?e.message:"Could not save layer");}
  finally{setBusy(false);}
 }
 async function remove(){
  if(!selected||busy||!window.confirm("Remove this layer? The original asset will remain in the library."))return;
  setBusy(true);setError("");
  try{await deleteVisualLayer(scope,selected);await reload();setSelected(null);setDraft(null);setPoints([]);clearHistory();}
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
  try{if(id)await updateLayerKeyframe(scope,selected,id,data);else await createLayerKeyframe(scope,selected,data);await loadPoints(selected);setKeyDraft(null);clearHistory();}
  catch(err){setError(err instanceof Error?err.message:"Could not save layer keyframe");}
  finally{setBusy(false);}
 }
 async function removePoint(id:string){
  if(!selected||busy||!window.confirm("Delete this layer keyframe?"))return;
  setBusy(true);setError("");
  try{await deleteLayerKeyframe(scope,selected,id);await loadPoints(selected);setKeyDraft(null);clearHistory();}
  catch(err){setError(err instanceof Error?err.message:"Could not delete layer keyframe");}
  finally{setBusy(false);}
 }
 async function positionLayerAtFrame(x:number,y:number){
  if(!selected||!draft||busy)return;
  const layerId=selected;
  const current=timelinePoints[layerId]??[];
  const exact=current.find(point=>point.frame_offset===playhead);
  const motion=current.length?interpolateKeyframes(current,playhead):draft;
  setBusy(true);setError("");
  try{
   if(exact)await updateLayerKeyframe(scope,layerId,exact.id,{position_x:x,position_y:y});
   else await createLayerKeyframe(scope,layerId,{frame_offset:playhead,position_x:x,position_y:y,scale:motion.scale,rotation:motion.rotation,opacity:motion.opacity,easing:"linear"});
   const updated=await listLayerKeyframes(scope,layerId);
   setTimelinePoints(previous=>({...previous,[layerId]:updated}));
   setPoints(updated);
   const edited=updated.find(point=>point.frame_offset===playhead);
   if(edited)setKeyDraft({...edited});
   record({kind:"position",layerId,frame:playhead,before:exact?{x:exact.position_x,y:exact.position_y}:null,after:{x,y},snapshot:{frame_offset:playhead,position_x:motion.position_x,position_y:motion.position_y,scale:motion.scale,rotation:motion.rotation,opacity:motion.opacity,easing:exact?.easing??"linear"}});
  }catch(err){setError(err instanceof Error?err.message:"Could not save character position");}
  finally{setBusy(false);}
 }
 async function movePoint(layerId:string,point:LayerKeyframe,targetFrame:number){
  if(busy||targetFrame===point.frame_offset)return;
  if(targetFrame<0||targetFrame>=holdFrames||timelinePoints[layerId]?.some(item=>item.id!==point.id&&item.frame_offset===targetFrame)){
   setError("That frame already contains a keyframe, or is outside the animation.");return;
  }
  setBusy(true);setError("");
  try{
   await updateLayerKeyframe(scope,layerId,point.id,{frame_offset:targetFrame});
   const updated=await listLayerKeyframes(scope,layerId);
   setTimelinePoints(previous=>({...previous,[layerId]:updated}));
   if(selected===layerId)setPoints(updated);
   setPlayhead(targetFrame);
   if(selected===layerId&&keyDraft?.id===point.id)setKeyDraft(previous=>previous?{...previous,frame_offset:targetFrame}:previous);
   record({kind:"move",layerId,keyframeId:point.id,before:point.frame_offset,after:targetFrame});
  }catch(err){setError(err instanceof Error?err.message:"Could not move keyframe");}
  finally{setBusy(false);}
 }
 async function applyPreset(){
  if(!selected||!draft||busy)return;
  const layerId=selected;
  const start=presetStart,end=presetEnd;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=holdFrames||start>=end){
   setError("Choose two different frames within the current shot.");return;
  }
  const existing=timelinePoints[layerId]??[];
  if(existing.some(point=>point.frame_offset===start||point.frame_offset===end)){
   setError("Preset frames already contain keyframes. Choose unoccupied frames to preserve existing animation.");return;
  }
  const base=existing.length?interpolateKeyframes(existing,start):draft;
  const generated=buildMotionPreset(preset,start,end,base);
  setBusy(true);setError("");setSuccess("");
  const created:string[]=[];
  try{
   for(const point of generated){
    const result=await createLayerKeyframe(scope,layerId,point);
    created.push(result.id);
   }
   await loadPoints(layerId);setPlayhead(start);setKeyDraft(null);clearHistory();
   setSuccess("Motion preset saved successfully. Two keyframes were created at frames "+start+" and "+end+".");
  }catch(err){
   const rollback=await Promise.allSettled(created.map(id=>deleteLayerKeyframe(scope,layerId,id)));
   try{await loadPoints(layerId);}catch{/* preserve original failure */}
   const rollbackFailed=rollback.some(item=>item.status==="rejected");
   setError((err instanceof Error?err.message:"Could not apply motion preset")+(rollbackFailed?" Some preset keyframes could not be rolled back; inspect the timeline.":""));
  }finally{setBusy(false);}
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
  {success&&<div className="vl-success" role="status" aria-live="polite">{success}</div>}
  <div className="vl-history-toolbar" aria-label="Animation history controls">
   <button type="button" className="secondary-action" disabled={busy||undoStack.current.length===0} onClick={()=>void historyStep(true)}><Undo2 size={15}/> Undo animation</button>
   <button type="button" className="secondary-action" disabled={busy||redoStack.current.length===0} onClick={()=>void historyStep(false)}><Redo2 size={15}/> Redo animation</button>
   <span>Undo/redo tracks timeline keyframe moves and preview position changes during this editing session.</span>
  </div>
  <LayerTimeline layers={layers} keyframes={timelinePoints} holdFrames={holdFrames} playhead={playhead} selectedLayerId={selected}
   onSeek={setPlayhead} busy={busy} onMoveKeyframe={movePoint} onSelectLayer={id=>{const layer=layers.find(item=>item.id===id);if(layer)select(layer);}}
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
     <DraggableLayerPreview key={selected+"-"+playhead} imageUrl={assetImageUrl(scope.projectId,draft.asset_id)}
      draft={draft} points={selected?timelinePoints[selected]??[]:[]} frame={playhead} busy={busy}
      onPosition={positionLayerAtFrame}/>
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

    {selected&&<section className="ak-panel vl-motion-presets" aria-label="Motion presets">
     <div className="ak-section-head"><div><span className="eyebrow">QUICK ANIMATION</span><h3>Motion presets</h3></div></div>
     <p className="vl-note">Generate two editable keyframes. Existing keyframes are never overwritten. Select two free frames.</p>
     <div className="vl-preset-fields">
      <label>Effect<select value={preset} onChange={event=>setPreset(event.target.value as MotionPreset)}>
       <option value="slide-in">Slide in</option><option value="slide-out">Slide out</option>
       <option value="zoom-in">Zoom in</option><option value="zoom-out">Zoom out</option>
       <option value="fade-in">Fade in</option><option value="fade-out">Fade out</option>
       <option value="rotate">Rotate 90°</option>
      </select></label>
      <label>Start frame<input type="number" min={0} max={Math.max(0,holdFrames-1)} step={1} value={presetStart} onChange={event=>setPresetStart(Number(event.target.value))}/></label>
      <label>End frame<input type="number" min={0} max={Math.max(0,holdFrames-1)} step={1} value={presetEnd} onChange={event=>setPresetEnd(Number(event.target.value))}/></label>
     </div>
     <button type="button" className="primary-action" disabled={busy||holdFrames<2} onClick={()=>void applyPreset()}>Apply motion preset</button>
    </section>}
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
