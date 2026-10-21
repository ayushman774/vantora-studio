import {useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Trash2} from "lucide-react";
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
 return <section className="animation-keyframe-editor">
  <div className="project-toolbar"><div><button type="button" className="secondary-action" onClick={onBack}><ArrowLeft size={15}/> Back to storyboard</button><div className="eyebrow" style={{marginTop:16}}>V0.16 · ANIMATION KEYFRAMES</div><h2>{frame.title}</h2><p>Animate transforms over this frame's {frame.hold_frames}-frame hold. Changes are stored locally.</p></div><button type="button" className="primary-action" disabled={busy||loading} onClick={()=>{setError("");setEditing(defaults(items.length?Math.min(frame.hold_frames-1,items[items.length-1].frame_offset+1):0));}}><Plus size={15}/> Add keyframe</button></div>
  {error&&<div className="project-error" role="alert">{error}</div>}
  {loading?<p>Loading keyframes…</p>:<div className="animatic-audio-clips">{items.length===0&&<p>No animation keyframes yet. Add a starting transform at offset 0, then another later in the hold.</p>}{items.map(item=><div key={item.id} className="animatic-audio-clip"><strong>{item.frame_offset}f</strong><span>X {item.position_x} · Y {item.position_y} · Scale {item.scale} · Rotation {item.rotation}° · Opacity {Math.round(item.opacity*100)}% · {item.easing}</span><button type="button" className="secondary-action" disabled={busy} onClick={()=>setEditing({...item})}>Edit</button><button type="button" className="danger-action icon-action" aria-label={"Delete keyframe "+item.frame_offset} disabled={busy} onClick={()=>void remove(item.id)}><Trash2 size={15}/></button></div>)}</div>}
  {editing&&<form className="project-form cinematic-editor" onSubmit={e=>void save(e)}><div className="project-form-heading"><h3>{editing.id?"Edit":"New"} keyframe</h3><button type="button" className="secondary-action" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
   <label>Frame offset (0–{frame.hold_frames-1})<input type="number" required min={0} max={frame.hold_frames-1} step={1} value={editing.frame_offset} onChange={e=>numeric("frame_offset",e.target.value)}/></label>
   <label>Position X (pixels)<input type="number" required min={-10000} max={10000} step="any" value={editing.position_x} onChange={e=>numeric("position_x",e.target.value)}/></label>
   <label>Position Y (pixels)<input type="number" required min={-10000} max={10000} step="any" value={editing.position_y} onChange={e=>numeric("position_y",e.target.value)}/></label>
   <label>Scale<input type="number" required min={0.01} max={10} step={0.01} value={editing.scale} onChange={e=>numeric("scale",e.target.value)}/></label>
   <label>Rotation (degrees)<input type="number" required min={-3600} max={3600} step="any" value={editing.rotation} onChange={e=>numeric("rotation",e.target.value)}/></label>
   <label>Opacity<input type="number" required min={0} max={1} step={0.05} value={editing.opacity} onChange={e=>numeric("opacity",e.target.value)}/></label>
   <label>Easing to next keyframe<select value={editing.easing} onChange={e=>setEditing({...editing,easing:e.target.value as KeyframeInput["easing"]})}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option></select></label>
   <button type="submit" className="primary-action" disabled={busy}>{busy?"Saving…":"Save keyframe"}</button>
  </form>}
  <p className="storyboard-summary">This stage saves animation data. Interpolated playback and MP4 rendering are being implemented next; existing camera motion and exports remain unchanged.</p>
 </section>;
}
