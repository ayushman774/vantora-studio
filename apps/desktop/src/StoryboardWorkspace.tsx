import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Pencil,Trash2,RefreshCw,PanelsTopLeft,Clock3,ChevronDown,Film,Download} from "lucide-react";
import {listAssets,uploadAsset,assetImageUrl,type Asset} from "./assetsApi";
import AnimaticPreview from "./AnimaticPreview";
import AnimationKeyframeEditor from "./AnimationKeyframeEditor";
import {listAudio,type AudioAsset} from "./audioApi";
import {listAudioClips,addAudioClip,editAudioClip,removeAudioClip,type AudioClip,type AudioClipInput} from "./animaticAudioApi";
import type {ProductionStatus} from "./sceneTypes";
import type {StoryboardFrame,StoryboardInput} from "./storyboardApi";
import {listStoryboardFrames,createStoryboardFrame,updateStoryboardFrame,deleteStoryboardFrame} from "./storyboardApi";

const statuses:ProductionStatus[]=["draft","planned","in_progress","review","approved"];
const blank=(number:number):StoryboardInput=>({number,title:"",description:"",composition:"",camera_notes:"",continuity_notes:"",hold_frames:24,motion_intensity:100,motion_easing:"linear",camera_motion:"none",transition:"cut",status:"draft",asset_id:null});
export default function StoryboardWorkspace({projectId,seasonId,episodeId,sceneId,shotId,shotTitle,onBack}:{projectId:string;seasonId:string;episodeId:string;sceneId:string;shotId:string;shotTitle:string;onBack:()=>void}){
 const [frames,setFrames]=useState<StoryboardFrame[]>([]);
 const [animationFrameId,setAnimationFrameId]=useState<string|null>(null);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [audioAssets,setAudioAssets]=useState<AudioAsset[]>([]);
 const [audioClips,setAudioClips]=useState<AudioClip[]>([]);
 const [audioBusy,setAudioBusy]=useState(false);
 const [audioError,setAudioError]=useState("");
 const [editor,setEditor]=useState<(StoryboardInput&{id?:string})|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [exporting,setExporting]=useState(false);
 const [error,setError]=useState("");
 const audioScope={projectId,seasonId,episodeId,sceneId,shotId};
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const [nextFrames,nextAssets,nextAudio,nextClips]=await Promise.all([listStoryboardFrames(projectId,seasonId,episodeId,sceneId,shotId),listAssets(projectId),listAudio(projectId),listAudioClips({projectId,seasonId,episodeId,sceneId,shotId})]);setFrames(nextFrames);setAssets(nextAssets);setAudioAssets(nextAudio);setAudioClips(nextClips);}
  catch(e){setError(e instanceof Error?e.message:"Could not load storyboard frames");}
  finally{setLoading(false);}
 },[projectId,seasonId,episodeId,sceneId,shotId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function save(e:FormEvent){
  e.preventDefault();if(!editor||busy)return;
  if(!editor.title.trim()||!Number.isInteger(editor.number)||editor.number<1||!Number.isInteger(editor.hold_frames)||editor.hold_frames<1||editor.hold_frames>100000){setError("Enter a title and valid positive frame numbers.");return;}
  setBusy(true);setError("");
  try{
   // Never send server-owned frame metadata back to the strict API.
   const data:StoryboardInput={
    number:editor.number,title:editor.title,description:editor.description,
    composition:editor.composition,camera_notes:editor.camera_notes,
    continuity_notes:editor.continuity_notes,hold_frames:editor.hold_frames,motion_intensity:editor.motion_intensity,motion_easing:editor.motion_easing,camera_motion:editor.camera_motion,transition:editor.transition,
    status:editor.status,asset_id:editor.asset_id
   };
   const id=editor.id;
   if(id)await updateStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,id,data);
   else await createStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,data);
   setEditor(null);await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Save failed");}
  finally{setBusy(false);}
 }
 async function addClip(assetId:string){
  if(audioBusy||!assetId)return;
  setAudioBusy(true);setAudioError("");
  try{const duration=Math.max(1,frames.reduce((sum,frame)=>sum+frame.hold_frames,0));await addAudioClip(audioScope,{audio_asset_id:assetId,start_frame:0,duration_frames:duration,volume:1,muted:false});setAudioClips(await listAudioClips(audioScope));}
  catch(e){setAudioError(e instanceof Error?e.message:"Unable to add audio clip");}
  finally{setAudioBusy(false);}
 }
 async function changeClip(id:string,data:Partial<AudioClipInput>){
  setAudioBusy(true);setAudioError("");
  try{await editAudioClip(audioScope,id,data);setAudioClips(await listAudioClips(audioScope));}
  catch(e){setAudioError(e instanceof Error?e.message:"Unable to update audio clip");}
  finally{setAudioBusy(false);}
 }
 async function deleteClip(id:string){
  if(!window.confirm("Remove this clip from the animatic timeline? The audio file stays in the library."))return;
  setAudioBusy(true);setAudioError("");
  try{await removeAudioClip(audioScope,id);setAudioClips(await listAudioClips(audioScope));}
  catch(e){setAudioError(e instanceof Error?e.message:"Unable to remove audio clip");}
  finally{setAudioBusy(false);}
 }
 async function exportMp4(){
  if(exporting)return;
  setExporting(true);setError("");
  try{
   const root="http://127.0.0.1:8000/api/v1/projects";
   const url=root+"/"+[projectId,"seasons",seasonId,"episodes",episodeId,"scenes",sceneId,"shots",shotId,"animatic-export"].map(encodeURIComponent).join("/");
   const response=await fetch(url,{method:"POST"});
   if(!response.ok){const body:unknown=await response.json().catch(()=>null);const detail=body&&typeof body==="object"&&"detail" in body?String(body.detail):"MP4 export failed";throw new Error(detail);}
   const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);
   const anchor=document.createElement("a");anchor.href=objectUrl;anchor.download="vantora-animatic-"+shotId.slice(0,8)+".mp4";document.body.appendChild(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  }catch(err){setError(err instanceof Error?err.message:"MP4 export failed");}
  finally{setExporting(false);}
 }
 async function remove(item:StoryboardFrame){
  if(!window.confirm("Permanently delete storyboard frame "+item.number+"?"))return;
  setBusy(true);setError("");
  try{await deleteStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,item.id);await refresh();}
  catch(err){setError(err instanceof Error?err.message:"Delete failed");}
  finally{setBusy(false);}
 }
 const animationFrame=frames.find(frame=>frame.id===animationFrameId);
 if(animationFrame)return <AnimationKeyframeEditor key={animationFrame.id} frame={animationFrame} scope={{projectId,seasonId,episodeId,sceneId,shotId,frameId:animationFrame.id}} onBack={()=>setAnimationFrameId(null)}/>;
 return <section className="storyboard-workspace">
  <div className="project-toolbar"><div><button className="secondary-action" onClick={onBack}><ArrowLeft size={15}/> Back to shots</button><div className="eyebrow" style={{marginTop:16}}>STORYBOARD / {shotTitle}</div><h2>Storyboard Frames</h2></div><div className="projects-actions"><button className="secondary-action" disabled={exporting||loading||!frames.length} title="Exports cinematic MP4 with camera motion, transitions, and audio. Animation keyframe rendering is not yet included; requires local FFmpeg." onClick={()=>void exportMp4()}><Download size={15}/>{exporting?"Rendering MP4…":"Export Cinematic MP4"}</button><button className="secondary-action" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button><button className="primary-action" onClick={()=>{setError("");setEditor(blank(Math.max(0,...frames.map(f=>f.number))+1));}}><Plus size={15}/> New frame</button></div></div>
  <div className="storyboard-overview"><div><span>SHOT STORYBOARD</span><strong>{frames.length} <small>frames</small></strong></div><div><span>TOTAL HOLD</span><strong>{frames.reduce((sum,frame)=>sum+frame.hold_frames,0)} <small>frames</small></strong></div><p>Sequence planning · Frames ordered by number · Local visual references</p></div>
  {!loading&&frames.length>0&&<AnimaticPreview projectId={projectId} frames={frames} assets={assets} audioAssets={audioAssets} audioClips={audioClips}/>}
  {!loading&&frames.length>0&&<section className="animatic-audio-editor"><div className="animatic-audio-heading"><div><span className="eyebrow">V0.15 · AUDIO TIMELINE</span><h3>Soundtrack & audio clips</h3><p>Position imported audio on this shot’s 24 FPS timeline. Audio clips are saved locally.</p></div><select aria-label="Add audio from library" disabled={audioBusy||!audioAssets.length} value="" onChange={e=>void addClip(e.target.value)}><option value="">+ Add audio clip</option>{audioAssets.map(a=><option key={a.id} value={a.id}>{a.title} · {a.category.replaceAll("_"," ")}</option>)}</select></div>{audioError&&<div className="project-error" role="alert">{audioError}</div>}{!audioAssets.length&&<p>Import MP3 or WAV files from the Audio Library first.</p>}{!audioClips.length&&<p>No audio clips attached to this shot yet.</p>}<div className="animatic-audio-clips">{audioClips.map(clip=>{const asset=audioAssets.find(a=>a.id===clip.audio_asset_id);return <div className="animatic-audio-clip" key={clip.id}><strong title={asset?.title}>{asset?.title??"Missing audio asset"}</strong><label>Start (frames)<input type="number" min={0} max={1000000} defaultValue={clip.start_frame} key={clip.id+"start"+clip.start_frame} disabled={audioBusy} onBlur={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=0&&value!==clip.start_frame)void changeClip(clip.id,{start_frame:value});}}/></label><label>Length (frames)<input type="number" min={1} max={1000000} defaultValue={clip.duration_frames} key={clip.id+"duration"+clip.duration_frames} disabled={audioBusy} onBlur={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>0&&value!==clip.duration_frames)void changeClip(clip.id,{duration_frames:value});}}/></label><label>Volume ({Math.round(clip.volume*100)}%)<input type="range" min={0} max={1} step={0.1} value={Math.min(1,clip.volume)} disabled={audioBusy} onChange={e=>void changeClip(clip.id,{volume:Number(e.target.value)})}/></label><label className="animatic-audio-mute"><input type="checkbox" checked={clip.muted} disabled={audioBusy} onChange={e=>void changeClip(clip.id,{muted:e.target.checked})}/> Mute</label><button type="button" className="danger-action icon-action" disabled={audioBusy} title="Remove clip" aria-label={"Remove "+(asset?.title??"audio clip")} onClick={()=>void deleteClip(clip.id)}><Trash2 size={15}/></button></div>;})}</div></section>}
  {error&&<div className="project-error" role="alert">{error}</div>}
  {editor&&<div className="workspace-editor-backdrop"><form className="project-form workspace-editor cinematic-editor" onSubmit={e=>void save(e)}>
   <div className="project-form-heading"><h2>{editor.id?"Edit":"New"} storyboard frame</h2><button type="button" className="secondary-action" disabled={busy} onClick={()=>setEditor(null)}>Cancel</button></div>
   <label>Frame number<input autoFocus type="number" min={1} step={1} required value={editor.number} onChange={e=>setEditor({...editor,number:Number(e.target.value)})}/></label>
   <label>Title<input required maxLength={160} value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})}/></label>
   <label>Visual description<textarea rows={3} maxLength={10000} value={editor.description} onChange={e=>setEditor({...editor,description:e.target.value})}/></label>
   <label>Composition / framing<textarea rows={3} maxLength={10000} value={editor.composition} onChange={e=>setEditor({...editor,composition:e.target.value})}/></label>
   <label>Camera notes<textarea rows={3} maxLength={5000} value={editor.camera_notes} onChange={e=>setEditor({...editor,camera_notes:e.target.value})}/></label>
   <label>Continuity notes<textarea rows={3} maxLength={5000} value={editor.continuity_notes} onChange={e=>setEditor({...editor,continuity_notes:e.target.value})}/></label>
   <label>Hold duration (frames)<input type="number" min={1} max={100000} step={1} required value={editor.hold_frames} onChange={e=>setEditor({...editor,hold_frames:Number(e.target.value)})}/></label>
   <label>Camera motion<select value={editor.camera_motion} onChange={e=>setEditor({...editor,camera_motion:e.target.value as StoryboardInput["camera_motion"]})}><option value="none">Static</option><option value="zoom-in">Slow zoom in</option><option value="zoom-out">Slow zoom out</option><option value="pan-left">Pan left</option><option value="pan-right">Pan right</option></select></label>
   <label>Motion intensity ({editor.motion_intensity}%)<input type="range" min={0} max={200} step={5} value={editor.motion_intensity} onChange={e=>setEditor({...editor,motion_intensity:Number(e.target.value)})}/></label>
   <label>Motion easing<select value={editor.motion_easing} onChange={e=>setEditor({...editor,motion_easing:e.target.value as StoryboardInput["motion_easing"]})}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in / out</option></select></label>
   <label>Transition<select value={editor.transition} onChange={e=>setEditor({...editor,transition:e.target.value as StoryboardInput["transition"]})}><option value="cut">Cut</option><option value="fade">Fade in / out</option><option value="cross-dissolve">Cross-dissolve from previous frame</option></select></label>
   <label>Visual reference<select value={editor.asset_id??""} onChange={e=>setEditor({...editor,asset_id:e.target.value||null})}><option value="">No image attached</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.title} ({asset.category})</option>)}</select></label>
   <label>Upload new image (PNG, JPEG, WebP, max 10 MB)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){setError("Choose a PNG, JPEG or WebP image up to 10 MB.");e.target.value="";return;}setBusy(true);setError("");try{const asset=await uploadAsset(projectId,file,"concept");setAssets(previous=>[...previous,asset]);setEditor(previous=>previous?{...previous,asset_id:asset.id}:previous);}catch(err){setError(err instanceof Error?err.message:"Image upload failed");}finally{setBusy(false);e.target.value="";}}}/></label>
   <label>Review status<select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value as ProductionStatus})}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
   <button className="primary-action" disabled={busy} type="submit">{busy?"Saving…":"Save frame"}</button>
  </form></div>}
  {loading?<div className="project-empty">Loading storyboard…</div>:frames.length===0?<div className="project-empty"><PanelsTopLeft size={32}/><h2>No storyboard frames yet</h2><p>Add your first frame to establish the visual composition for this shot.</p><button className="primary-action" onClick={()=>setEditor(blank(1))}><Plus size={15}/> Create first frame</button></div>:<div className="storyboard-grid">
   {frames.map(frame=><article className="storyboard-card" key={frame.id}>
    <div className="storyboard-frame-preview"><div className="storyboard-preview-top"><span>FRAME {String(frame.number).padStart(2,"0")}</span><span className={"storyboard-status storyboard-status-"+frame.status}>{frame.status.replaceAll("_"," ")}</span></div><div className="storyboard-preview-center">{frame.asset_id&&assets.some(asset=>asset.id===frame.asset_id)?<img className="storyboard-attached-image" src={assetImageUrl(projectId,frame.asset_id)} alt={"Visual reference for "+frame.title} loading="lazy"/>:<><Film size={30} strokeWidth={1.3}/><span>Visual pending</span></>}</div><div className="storyboard-preview-bottom"><Clock3 size={13}/>{frame.hold_frames} frames</div></div>
    <div className="storyboard-card-body"><h3 title={frame.title}>{frame.title}</h3><p className="storyboard-summary">{frame.description||"No visual description added yet."}</p>
     <details className="storyboard-details"><summary>Production notes <ChevronDown size={15}/></summary><div className="storyboard-notes">
      <p><b>Composition</b>{frame.composition||"Not specified"}</p><p><b>Camera</b>{frame.camera_notes||"Not specified"}</p><p><b>Continuity</b>{frame.continuity_notes||"Not specified"}</p>
     </div></details>
     <div className="storyboard-card-actions"><button className="secondary-action" onClick={()=>setAnimationFrameId(frame.id)}><Film size={14}/> Animate</button><button className="secondary-action" onClick={()=>{setError("");setEditor({...frame});}}><Pencil size={14}/> Edit frame</button><button className="danger-action icon-action" aria-label={"Delete frame "+frame.number} title="Delete frame" disabled={busy} onClick={()=>void remove(frame)}><Trash2 size={15}/></button></div>
    </div></article>)}
  </div>}
 </section>;
}
