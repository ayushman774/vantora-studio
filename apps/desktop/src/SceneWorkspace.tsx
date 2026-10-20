import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Plus,Pencil,Trash2,RefreshCw,Clapperboard} from "lucide-react";
import type {Scene,Shot,ProductionStatus} from "./sceneTypes";
import {listScenes,createScene,updateScene,deleteScene,listShots,createShot,updateShot,deleteShot} from "./scenesApi";

const statuses:ProductionStatus[]=["draft","planned","in_progress","review","approved"];
type Editor={kind:"scene"|"shot";id?:string;number:number;title:string;description:string;status:ProductionStatus;location:string;time_of_day:string;camera:string;action:string;duration_frames:number};
const initial=(kind:"scene"|"shot",number:number,item?:Scene|Shot):Editor=>({
  kind,id:item?.id,number:item?.number??number,title:item?.title??"",description:item?.description??"",status:item?.status??"draft",
  location:item&&"location" in item?item.location:"",time_of_day:item&&"time_of_day" in item?item.time_of_day:"",
  camera:item&&"camera" in item?item.camera:"",action:item&&"action" in item?item.action:"",duration_frames:item&&"duration_frames" in item?item.duration_frames:72
});
export default function SceneWorkspace({projectId,seasonId,episodeId,episodeTitle,onBack}:{projectId:string;seasonId:string;episodeId:string;episodeTitle:string;onBack:()=>void}){
  const [scenes,setScenes]=useState<Scene[]>([]);
  const [shots,setShots]=useState<Shot[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{const items=await listScenes(projectId,seasonId,episodeId);setScenes(items);setSelected(previous=>items.some(s=>s.id===previous)?previous:items[0]?.id??null);}
    catch(e){setError(e instanceof Error?e.message:"Could not load scenes");}
    finally{setLoading(false);}
  },[projectId,seasonId,episodeId]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!selected){setShots([]);return;}
    let active=true;setShots([]);
    listShots(projectId,seasonId,episodeId,selected).then(items=>{if(active)setShots(items);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load shots");});
    return()=>{active=false;};
  },[projectId,seasonId,episodeId,selected]);
  const scene=scenes.find(s=>s.id===selected);
  async function refreshShots(id:string){setShots(await listShots(projectId,seasonId,episodeId,id));}
  async function save(event:FormEvent){
    event.preventDefault();if(!editor||busy)return;
    if(!editor.title.trim()||!Number.isInteger(editor.number)||editor.number<1||editor.kind==="shot"&&(!Number.isInteger(editor.duration_frames)||editor.duration_frames<1)){setError("Enter a title and valid positive whole numbers.");return;}
    setBusy(true);setError("");
    try{
      if(editor.kind==="scene"){
        const data={number:editor.number,title:editor.title.trim(),description:editor.description,location:editor.location,time_of_day:editor.time_of_day,status:editor.status};
        const result=editor.id?await updateScene(projectId,seasonId,episodeId,editor.id,data):await createScene(projectId,seasonId,episodeId,data);
        await refresh();setSelected(result.id);
      }else if(selected){
        const data={number:editor.number,title:editor.title.trim(),description:editor.description,camera:editor.camera,action:editor.action,duration_frames:editor.duration_frames,status:editor.status};
        if(editor.id)await updateShot(projectId,seasonId,episodeId,selected,editor.id,data);
        else await createShot(projectId,seasonId,episodeId,selected,data);
        await refreshShots(selected);
      }
      setEditor(null);
    }catch(e){setError(e instanceof Error?e.message:"Save failed");}
    finally{setBusy(false);}
  }
  async function removeScene(item:Scene){
    if(!window.confirm("Delete scene "+item.number+" and ALL its shots permanently?"))return;
    setBusy(true);setError("");
    try{await deleteScene(projectId,seasonId,episodeId,item.id);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Delete failed");}finally{setBusy(false);}
  }
  async function removeShot(item:Shot){
    if(!selected||!window.confirm("Delete shot "+item.number+" permanently?"))return;
    setBusy(true);setError("");
    try{await deleteShot(projectId,seasonId,episodeId,selected,item.id);await refreshShots(selected);}
    catch(e){setError(e instanceof Error?e.message:"Delete failed");}finally{setBusy(false);}
  }
  return <section className="scene-workspace">
    <div className="project-toolbar"><div><button className="secondary-action" onClick={onBack}><ArrowLeft size={15}/> Episodes</button><div className="eyebrow" style={{marginTop:16}}>CINEMATIC PRODUCTION / {episodeTitle}</div><h2>Scenes & Shots</h2></div><div className="projects-actions"><button className="secondary-action" onClick={()=>void refresh()} disabled={loading||busy}><RefreshCw size={15}/> Refresh</button><button className="primary-action" onClick={()=>setEditor(initial("scene",Math.max(0,...scenes.map(s=>s.number))+1))}><Plus size={15}/> New scene</button></div></div>
    {error&&<div className="project-error" role="alert">{error}</div>}
    {editor&&<div className="workspace-editor-backdrop"><form className="project-form workspace-editor cinematic-editor" onSubmit={e=>void save(e)}>
      <div className="project-form-heading"><h2>{editor.id?"Edit":"New"} {editor.kind}</h2><button type="button" className="secondary-action" onClick={()=>setEditor(null)} disabled={busy}>Cancel</button></div>
      <label>Number<input autoFocus required type="number" min={1} step={1} value={editor.number} onChange={e=>setEditor({...editor,number:Number(e.target.value)})}/></label>
      <label>Title<input required maxLength={160} value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})}/></label>
      <label>Description<textarea maxLength={10000} rows={3} value={editor.description} onChange={e=>setEditor({...editor,description:e.target.value})}/></label>
      {editor.kind==="scene"?<><label>Location<input maxLength={160} value={editor.location} onChange={e=>setEditor({...editor,location:e.target.value})}/></label><label>Time of day<input maxLength={80} value={editor.time_of_day} onChange={e=>setEditor({...editor,time_of_day:e.target.value})}/></label></>:<><label>Camera direction<textarea maxLength={5000} rows={2} value={editor.camera} onChange={e=>setEditor({...editor,camera:e.target.value})}/></label><label>Character action / choreography<textarea maxLength={10000} rows={3} value={editor.action} onChange={e=>setEditor({...editor,action:e.target.value})}/></label><label>Duration (frames)<input required type="number" min={1} max={100000} step={1} value={editor.duration_frames} onChange={e=>setEditor({...editor,duration_frames:Number(e.target.value)})}/></label></>}
      <label>Production status<select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value as ProductionStatus})}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
      <button className="primary-action" type="submit" disabled={busy}>{busy?"Saving…":"Save "+editor.kind}</button>
    </form></div>}
    {loading?<div className="project-empty">Loading scenes…</div>:<div className="cinematic-production-layout">
      <aside className="cinematic-season-list"><div className="cinematic-panel-label"><Clapperboard size={16}/> Scenes <span>{scenes.length}</span></div>
        {scenes.length===0&&<div className="cinematic-episode-empty">No scenes yet. Create the first scene.</div>}
        {scenes.map(s=><button key={s.id} className={"cinematic-season-item"+(selected===s.id?" active":"")} onClick={()=>setSelected(s.id)}><span className="cinematic-season-index">{String(s.number).padStart(2,"0")}</span><span className="cinematic-season-name"><strong>{s.title}</strong><small>{s.status.replaceAll("_"," ")}{s.location?" · "+s.location:""}</small></span></button>)}
      </aside>
      <div className="cinematic-episode-panel">{scene?<><div className="cinematic-episode-header"><div><span className="project-type">SCENE {scene.number} · {scene.status.replaceAll("_"," ").toUpperCase()}</span><h3>{scene.title}</h3>{scene.description&&<p>{scene.description}</p>}<p>{[scene.location,scene.time_of_day].filter(Boolean).join(" · ")}</p></div><div className="projects-actions"><button className="secondary-action icon-action" aria-label="Edit scene" onClick={()=>setEditor(initial("scene",scene.number,scene))}><Pencil size={15}/></button><button className="danger-action icon-action" disabled={busy} aria-label="Delete scene" onClick={()=>void removeScene(scene)}><Trash2 size={15}/></button></div></div>
      <div className="cinematic-episode-toolbar"><strong>Shots <span>{shots.length}</span></strong><button className="primary-action" onClick={()=>setEditor(initial("shot",Math.max(0,...shots.map(s=>s.number))+1))}><Plus size={15}/> Add shot</button></div>
      <div className="cinematic-episode-list">{shots.length===0?<div className="cinematic-episode-empty">No shots in this scene yet.</div>:shots.map(shot=><article className="cinematic-episode-row" key={shot.id}><div className="cinematic-episode-number">{String(shot.number).padStart(2,"0")}</div><div className="workspace-episode-info"><strong>{shot.title}</strong><p>{shot.status.replaceAll("_"," ")} · {shot.duration_frames} frames</p>{shot.description&&<p>{shot.description}</p>}{shot.camera&&<p>Camera: {shot.camera}</p>}{shot.action&&<p>Action: {shot.action}</p>}</div><button className="secondary-action icon-action" aria-label={"Edit shot "+shot.number} onClick={()=>setEditor(initial("shot",shot.number,shot))}><Pencil size={15}/></button><button className="danger-action icon-action" disabled={busy} aria-label={"Delete shot "+shot.number} onClick={()=>void removeShot(shot)}><Trash2 size={15}/></button></article>)}</div></>:<div className="cinematic-episode-empty">Select or create a scene to plan its shots.</div>}</div>
    </div>}
  </section>;
}
