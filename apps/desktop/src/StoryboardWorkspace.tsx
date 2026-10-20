import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Pencil,Trash2,RefreshCw,PanelsTopLeft} from "lucide-react";
import type {ProductionStatus} from "./sceneTypes";
import type {StoryboardFrame,StoryboardInput} from "./storyboardApi";
import {listStoryboardFrames,createStoryboardFrame,updateStoryboardFrame,deleteStoryboardFrame} from "./storyboardApi";

const statuses:ProductionStatus[]=["draft","planned","in_progress","review","approved"];
const blank=(number:number):StoryboardInput=>({number,title:"",description:"",composition:"",camera_notes:"",continuity_notes:"",hold_frames:24,status:"draft"});
export default function StoryboardWorkspace({projectId,seasonId,episodeId,sceneId,shotId,shotTitle,onBack}:{projectId:string;seasonId:string;episodeId:string;sceneId:string;shotId:string;shotTitle:string;onBack:()=>void}){
 const [frames,setFrames]=useState<StoryboardFrame[]>([]);
 const [editor,setEditor]=useState<(StoryboardInput&{id?:string})|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{setFrames(await listStoryboardFrames(projectId,seasonId,episodeId,sceneId,shotId));}
  catch(e){setError(e instanceof Error?e.message:"Could not load storyboard frames");}
  finally{setLoading(false);}
 },[projectId,seasonId,episodeId,sceneId,shotId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function save(e:FormEvent){
  e.preventDefault();if(!editor||busy)return;
  if(!editor.title.trim()||!Number.isInteger(editor.number)||editor.number<1||!Number.isInteger(editor.hold_frames)||editor.hold_frames<1||editor.hold_frames>100000){setError("Enter a title and valid positive frame numbers.");return;}
  setBusy(true);setError("");
  try{
   const {id,...data}=editor;
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
  <p className="storyboard-help">Plan each visual beat of this shot. Frames are ordered by number. Image attachment and AI-assisted generation are planned for a later phase.</p>
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
   <label>Review status<select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value as ProductionStatus})}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
   <button className="primary-action" disabled={busy} type="submit">{busy?"Saving…":"Save frame"}</button>
  </form></div>}
  {loading?<div className="project-empty">Loading storyboard…</div>:frames.length===0?<div className="project-empty"><PanelsTopLeft size={32}/><h2>No storyboard frames yet</h2><p>Add your first frame to establish the visual composition for this shot.</p><button className="primary-action" onClick={()=>setEditor(blank(1))}><Plus size={15}/> Create first frame</button></div>:<div className="storyboard-grid">
   {frames.map(frame=><article className="storyboard-card" key={frame.id}><div className="storyboard-frame-preview"><PanelsTopLeft size={34}/><span>FRAME {String(frame.number).padStart(2,"0")}</span><small>Visual reference not attached</small></div><div className="storyboard-card-body"><div className="storyboard-card-head"><strong>{frame.title}</strong><span>{frame.status.replaceAll("_"," ")}</span></div><div className="storyboard-frame-meta">{frame.hold_frames} hold frames</div>{frame.description&&<p>{frame.description}</p>}{frame.composition&&<p><b>Composition:</b> {frame.composition}</p>}{frame.camera_notes&&<p><b>Camera:</b> {frame.camera_notes}</p>}{frame.continuity_notes&&<p><b>Continuity:</b> {frame.continuity_notes}</p>}<div className="projects-actions"><button className="secondary-action" onClick={()=>{setError("");setEditor({...frame});}}><Pencil size={14}/> Edit</button><button className="danger-action" disabled={busy} onClick={()=>void remove(frame)}><Trash2 size={14}/> Delete</button></div></div></article>)}
  </div>}
 </section>;
}
