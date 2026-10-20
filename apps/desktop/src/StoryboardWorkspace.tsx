import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Pencil,Trash2,RefreshCw,PanelsTopLeft,Clock3,ChevronDown,Film} from "lucide-react";
import {listAssets,uploadAsset,assetImageUrl,type Asset} from "./assetsApi";
import AnimaticPreview from "./AnimaticPreview";
import type {ProductionStatus} from "./sceneTypes";
import type {StoryboardFrame,StoryboardInput} from "./storyboardApi";
import {listStoryboardFrames,createStoryboardFrame,updateStoryboardFrame,deleteStoryboardFrame} from "./storyboardApi";

const statuses:ProductionStatus[]=["draft","planned","in_progress","review","approved"];
const blank=(number:number):StoryboardInput=>({number,title:"",description:"",composition:"",camera_notes:"",continuity_notes:"",hold_frames:24,status:"draft",asset_id:null});
export default function StoryboardWorkspace({projectId,seasonId,episodeId,sceneId,shotId,shotTitle,onBack}:{projectId:string;seasonId:string;episodeId:string;sceneId:string;shotId:string;shotTitle:string;onBack:()=>void}){
 const [frames,setFrames]=useState<StoryboardFrame[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [editor,setEditor]=useState<(StoryboardInput&{id?:string})|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const [nextFrames,nextAssets]=await Promise.all([listStoryboardFrames(projectId,seasonId,episodeId,sceneId,shotId),listAssets(projectId)]);setFrames(nextFrames);setAssets(nextAssets);}
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
    continuity_notes:editor.continuity_notes,hold_frames:editor.hold_frames,
    status:editor.status,asset_id:editor.asset_id
   };
   const id=editor.id;
   if(id)await updateStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,id,data);
   else await createStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,data);
   setEditor(null);await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Save failed");}
  finally{setBusy(false);}
 }
 async function remove(item:StoryboardFrame){
  if(!window.confirm("Permanently delete storyboard frame "+item.number+"?"))return;
  setBusy(true);setError("");
  try{await deleteStoryboardFrame(projectId,seasonId,episodeId,sceneId,shotId,item.id);await refresh();}
  catch(err){setError(err instanceof Error?err.message:"Delete failed");}
  finally{setBusy(false);}
 }
 return <section className="storyboard-workspace">
  <div className="project-toolbar"><div><button className="secondary-action" onClick={onBack}><ArrowLeft size={15}/> Back to shots</button><div className="eyebrow" style={{marginTop:16}}>STORYBOARD / {shotTitle}</div><h2>Storyboard Frames</h2></div><div className="projects-actions"><button className="secondary-action" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button><button className="primary-action" onClick={()=>{setError("");setEditor(blank(Math.max(0,...frames.map(f=>f.number))+1));}}><Plus size={15}/> New frame</button></div></div>
  <div className="storyboard-overview"><div><span>SHOT STORYBOARD</span><strong>{frames.length} <small>frames</small></strong></div><div><span>TOTAL HOLD</span><strong>{frames.reduce((sum,frame)=>sum+frame.hold_frames,0)} <small>frames</small></strong></div><p>Sequence planning · Frames ordered by number · Local visual references</p></div>
  {!loading&&frames.length>0&&<AnimaticPreview projectId={projectId} frames={frames} assets={assets}/>}
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
     <div className="storyboard-card-actions"><button className="secondary-action" onClick={()=>{setError("");setEditor({...frame});}}><Pencil size={14}/> Edit frame</button><button className="danger-action icon-action" aria-label={"Delete frame "+frame.number} title="Delete frame" disabled={busy} onClick={()=>void remove(frame)}><Trash2 size={15}/></button></div>
    </div></article>)}
  </div>}
 </section>;
}
