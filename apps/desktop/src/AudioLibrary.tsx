import {useCallback,useEffect,useState,type ChangeEvent} from "react";
import {Music,RefreshCw,Trash2,Upload} from "lucide-react";
import {listProjects,type Project} from "./projects";
import {audioFileUrl,deleteAudio,listAudio,updateAudio,uploadAudio,type AudioAsset,type AudioCategory} from "./audioApi";

const categories:AudioCategory[]=["music","sound_effect","voice"];
const label=(category:AudioCategory)=>({music:"Music",sound_effect:"Sound effect",voice:"Voice recording"})[category];
export default function AudioLibrary(){
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectId,setProjectId]=useState("");
 const [items,setItems]=useState<AudioAsset[]>([]);
 const [category,setCategory]=useState<AudioCategory>("music");
 const [filter,setFilter]=useState("all");
 const [search,setSearch]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;listProjects().then(data=>{if(active){setProjects(data);setProjectId(data[0]?.id??"");}}).catch(e=>{if(active){setError(String(e));setLoading(false);}});return()=>{active=false;};},[]);
 const refresh=useCallback(async()=>{if(!projectId){setItems([]);setLoading(false);return;}setLoading(true);try{setItems(await listAudio(projectId));setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load audio");}finally{setLoading(false);}},[projectId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function upload(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value="";if(!file||!projectId||busy)return;
  if(!["audio/mpeg","audio/wav","audio/x-wav","audio/wave"].includes(file.type)||file.size>50*1024*1024){setError("Select an MP3 or WAV file up to 50 MB.");return;}
  setBusy(true);try{await uploadAudio(projectId,file,category);await refresh();}catch(err){setError(err instanceof Error?err.message:"Upload failed");}finally{setBusy(false);}
 }
 async function rename(item:AudioAsset){const title=window.prompt("Audio title",item.title)?.trim();if(!title||title===item.title)return;setBusy(true);try{await updateAudio(projectId,item.id,{title});await refresh();}catch(e){setError(e instanceof Error?e.message:"Rename failed");}finally{setBusy(false);}}
 async function remove(item:AudioAsset){if(!window.confirm(`Permanently delete "${item.title}"?`))return;setBusy(true);try{await deleteAudio(projectId,item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:"Delete failed");}finally{setBusy(false);}}
 const visible=items.filter(item=>(filter==="all"||item.category===filter)&&item.title.toLowerCase().includes(search.toLowerCase()));
 return <section className="asset-library">
  <div className="projects-heading asset-heading"><div><div className="eyebrow">V0.15 · LOCAL AUDIO PRODUCTION</div><h1>Audio Library</h1><p className="intro">Import, organize and audition music, sound effects and voice recordings. Files remain on your computer.</p></div><button className="secondary-action" disabled={!projectId||loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<div className="project-error" role="alert">{error}</div>}
  <div className="asset-controls"><label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}>{projects.length===0&&<option value="">No projects</option>}{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Filter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All audio</option>{categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label><label className="asset-search">Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search audio…" /></label></div>
  <div className="asset-uploadbar"><div><strong>{visible.length} audio assets</strong><span>MP3 / WAV · Max 50 MB per file</span></div><div className="projects-actions"><select aria-label="Audio upload category" value={category} onChange={e=>setCategory(e.target.value as AudioCategory)}>{categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select><label className={projectId&&!busy?"primary-action asset-upload":"primary-action asset-upload disabled"}><Upload size={15}/>{busy?"Working…":"Import audio"}<input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" disabled={!projectId||busy} onChange={e=>void upload(e)}/></label></div></div>
  {loading?<div className="project-empty">Loading audio…</div>:!projectId?<div className="project-empty">Create a project to begin importing audio.</div>:visible.length===0?<div className="project-empty"><Music size={32}/><h2>No audio assets</h2><p>Import music, sound effects or voice recordings to begin.</p></div>:<div className="asset-grid">{visible.map(item=><article className="asset-card" key={item.id}><div className="asset-card-info"><span className="project-type">{label(item.category)}</span><h3>{item.title}</h3><small>{(item.size_bytes/1024/1024).toFixed(2)} MB · {item.original_name}</small><audio controls preload="none" src={audioFileUrl(projectId,item.id)} style={{width:"100%",marginTop:12}} aria-label={`Preview ${item.title}`}/><div className="projects-actions"><button className="secondary-action" disabled={busy} onClick={()=>void rename(item)}>Rename</button><button className="danger-action icon-action" disabled={busy} title="Delete audio" aria-label={`Delete ${item.title}`} onClick={()=>void remove(item)}><Trash2 size={15}/></button></div></div></article>)}</div>}
 </section>;
}
