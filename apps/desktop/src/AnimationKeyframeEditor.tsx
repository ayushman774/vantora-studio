import {useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Trash2,Pencil,Clapperboard,Move,RotateCw,Layers} from "lucide-react";
import type {StoryboardFrame} from "./storyboardApi";
import {createKeyframe,deleteKeyframe,listKeyframes,updateKeyframe,type AnimationKeyframe,type KeyframeInput,type KeyframeScope} from "./animationKeyframesApi";

const defaults=(offset:number):KeyframeInput=>({frame_offset:offset,position_x:0,position_y:0,scale:1,rotation:0,opacity:1,easing:"linear"});
export default function AnimationKeyframeEditor({scope,frame,onBack}:{scope:KeyframeScope;frame:StoryboardFrame;onBack:()=>void}){
 const [items,setItems]=useState<AnimationKeyframe[]>([]);
 const [editing,setEditing]=useState<(KeyframeInput&{id?:string})|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");void listKeyframes(scope).then(result=>{if(active)setItems(result);}).catch(err=>{if(active)setError(err instanceof Error?err.message:"Could not load keyframes");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[scope.projectId,scope.seasonId,scope.episodeId,scope.sceneId,scope.shotId,scope.frameId]);
 async function save(event:FormEvent){
  event.preventDefault();if(!editing||busy)return;
  const {id,...data}=editing;
  if(!Number.isInteger(data.frame_offset)||data.frame_offset<0||data.frame_offset>=frame.hold_frames||!Number.isFinite(data.scale)||data.scale<=0||data.scale>10||data.opacity<0||data.opacity>1||![data.position_x,data.position_y,data.rotation,data.opacity].every(Number.isFinite)){setError("Check frame offset and transform values.");return;}
  setBusy(true);setError("");
  try{if(id)await updateKeyframe(scope,id,data);else await createKeyframe(scope,data);setItems(await listKeyframes(scope));setEditing(null);}
  catch(err){setError(err instanceof Error?err.message:"Could not save keyframe");}
  finally{setBusy(false);}
 }
 async function remove(id:string){if(!window.confirm("Delete this animation keyframe?"))return;setBusy(true);setError("");try{await deleteKeyframe(scope,id);setItems(await listKeyframes(scope));if(editing?.id===id)setEditing(null);}catch(err){setError(err instanceof Error?err.message:"Could not delete keyframe");}finally{setBusy(false);}}
 const numeric=(field:"frame_offset"|"position_x"|"position_y"|"scale"|"rotation"|"opacity",value:string)=>setEditing(prev=>prev?{...prev,[field]:Number(value)}:prev);
 const selectKeyframe=(item:AnimationKeyframe)=>{setError("");setEditing({...item});};
 const newKeyframe=()=>{setError("");const used=new Set(items.map(item=>item.frame_offset));const offset=Array.from({length:frame.hold_frames},(_,i)=>i).find(i=>!used.has(i));setEditing(defaults(offset??Math.max(0,frame.hold_frames-1)));};
 const sorted=[...items].sort((a,b)=>a.frame_offset-b.frame_offset);
 return <section className="animation-keyframe-editor">
  <header className="ak-header">
   <div className="ak-header-main"><button type="button" className="secondary-action" onClick={onBack}><ArrowLeft size={15}/> Storyboard</button><span className="eyebrow">V0.16 / ANIMATION WORKSPACE</span><h2>{frame.title}</h2><p>Design frame-by-frame motion using precise transform keyframes.</p></div>
   <button type="button" className="primary-action" disabled={busy||loading||items.length>=frame.hold_frames} onClick={newKeyframe}><Plus size={16}/> Add keyframe</button>
  </header>
  <div className="ak-stats"><div><small>DURATION</small><strong>{frame.hold_frames} <span>frames</span></strong></div><div><small>KEYFRAMES</small><strong>{items.length}</strong></div><div><small>FRAME RATE</small><strong>24 <span>FPS</span></strong></div><div><small>ANIMATION</small><strong>{items.length>1?"Ready to preview":items.length===1?"Add another keyframe":"Not configured"}</strong></div></div>
  {error&&<div className="project-error" role="alert">{error}</div>}
  <div className="ak-layout">
   <div className="ak-main">
    <section className="ak-panel"><div className="ak-section-head"><div><span className="eyebrow">MOTION TIMELINE</span><h3>Keyframe sequence</h3></div><span className="ak-muted">{frame.hold_frames} frames · {(frame.hold_frames/24).toFixed(2)}s</span></div>
     <div className="ak-ruler"><span>0f</span><span>{Math.floor((frame.hold_frames-1)/2)}f</span><span>{frame.hold_frames-1}f</span></div>
     <div className="ak-track" aria-label="Keyframe timeline">{sorted.map(item=><button type="button" key={item.id} className={"ak-marker"+(editing?.id===item.id?" selected":"")} style={{left:`${(item.frame_offset/Math.max(1,frame.hold_frames-1))*100}%`}} title={`Edit keyframe at ${item.frame_offset} frames`} aria-label={`Edit keyframe at ${item.frame_offset} frames`} onClick={()=>selectKeyframe(item)}><span/></button>)}</div>
     <p className="ak-hint">Select a marker or keyframe below to edit its properties.</p>
    </section>
    <section className="ak-panel"><div className="ak-section-head"><div><span className="eyebrow">KEYFRAME LIBRARY</span><h3>Saved keyframes</h3></div><span className="ak-count">{items.length} total</span></div>
     {loading?<p className="ak-muted">Loading keyframes…</p>:items.length===0?<div className="ak-empty"><Clapperboard size={30}/><h4>No keyframes yet</h4><p>Create a starting pose, then add another keyframe to define the movement.</p><button type="button" className="secondary-action" onClick={newKeyframe}><Plus size={15}/> Create first keyframe</button></div>:<div className="ak-list">{sorted.map((item,index)=><article className={"ak-item"+(editing?.id===item.id?" active":"")} key={item.id}><div className="ak-index">{String(index+1).padStart(2,"0")}</div><div className="ak-item-info"><div className="ak-item-title"><strong>Frame {item.frame_offset}</strong><span>{item.easing.replaceAll("-"," ")}</span></div><div className="ak-values"><span><Move size={13}/> {item.position_x}, {item.position_y} px</span><span><Layers size={13}/> {item.scale}×</span><span><RotateCw size={13}/> {item.rotation}°</span><span>Opacity {Math.round(item.opacity*100)}%</span></div></div><div className="ak-actions"><button type="button" className="secondary-action" disabled={busy} onClick={()=>selectKeyframe(item)} aria-label={`Edit keyframe ${item.frame_offset}`}><Pencil size={14}/> Edit</button><button type="button" className="danger-action icon-action" disabled={busy} aria-label={`Delete keyframe ${item.frame_offset}`} onClick={()=>void remove(item.id)}><Trash2 size={15}/></button></div></article>)}</div>}
    </section>
   </div>
   <aside className="ak-side">
    <section className="ak-panel ak-inspector"><div className="ak-section-head"><div><span className="eyebrow">PROPERTIES</span><h3>{editing?(editing.id?"Edit keyframe":"New keyframe"):"Transform inspector"}</h3></div></div>
     {editing?<form className="ak-form" onSubmit={e=>void save(e)}>
      <div className="ak-field"><label htmlFor="ak-offset">Timeline position <span>Frame</span></label><input id="ak-offset" type="number" required min={0} max={frame.hold_frames-1} step={1} value={editing.frame_offset} onChange={e=>numeric("frame_offset",e.target.value)}/><small>Valid range: 0–{frame.hold_frames-1}</small></div>
      <div className="ak-field-group"><div className="ak-field"><label htmlFor="ak-x">Position X <span>px</span></label><input id="ak-x" type="number" required min={-10000} max={10000} step="any" value={editing.position_x} onChange={e=>numeric("position_x",e.target.value)}/></div><div className="ak-field"><label htmlFor="ak-y">Position Y <span>px</span></label><input id="ak-y" type="number" required min={-10000} max={10000} step="any" value={editing.position_y} onChange={e=>numeric("position_y",e.target.value)}/></div></div>
      <div className="ak-field-group"><div className="ak-field"><label htmlFor="ak-scale">Scale <span>×</span></label><input id="ak-scale" type="number" required min={0.01} max={10} step={0.01} value={editing.scale} onChange={e=>numeric("scale",e.target.value)}/></div><div className="ak-field"><label htmlFor="ak-rotation">Rotation <span>°</span></label><input id="ak-rotation" type="number" required min={-3600} max={3600} step="any" value={editing.rotation} onChange={e=>numeric("rotation",e.target.value)}/></div></div>
      <div className="ak-field"><label htmlFor="ak-opacity">Opacity <span>{Math.round(editing.opacity*100)}%</span></label><input id="ak-opacity" type="range" min={0} max={1} step={0.05} value={editing.opacity} onChange={e=>numeric("opacity",e.target.value)}/></div>
      <div className="ak-field"><label htmlFor="ak-easing">Interpolation</label><select id="ak-easing" value={editing.easing} onChange={e=>setEditing({...editing,easing:e.target.value as KeyframeInput["easing"]})}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in / out</option></select></div>
      <div className="ak-form-actions"><button type="button" className="secondary-action" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button><button type="submit" className="primary-action" disabled={busy}>{busy?"Saving…":"Save keyframe"}</button></div>
     </form>:<div className="ak-inspector-empty"><Move size={28}/><p>Select a keyframe on the timeline or create a new one to edit its transform.</p></div>}
    </section>
    <div className="ak-notice">Keyframes are saved locally and visible in animatic playback. MP4 keyframe rendering is the next production step.</div>
   </aside>
  </div>
 </section>;
}
