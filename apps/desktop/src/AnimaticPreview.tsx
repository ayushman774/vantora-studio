import {useEffect,useMemo,useRef,useState} from "react";
import {Play,Pause,RotateCcw,SkipBack,SkipForward,Film} from "lucide-react";
import {assetImageUrl,type Asset} from "./assetsApi";
import type {StoryboardFrame} from "./storyboardApi";

const FPS=24; // v0.12 uses a fixed preview rate; project FPS support can follow.
export default function AnimaticPreview({projectId,frames,assets}:{projectId:string;frames:StoryboardFrame[];assets:Asset[]}){
 const ordered=useMemo(()=>[...frames].sort((a,b)=>a.number-b.number||a.id.localeCompare(b.id)),[frames]);
 const starts=useMemo(()=>{let offset=0;return ordered.map(frame=>{const start=offset;offset+=frame.hold_frames;return start;});},[ordered]);
 const total=ordered.reduce((sum,frame)=>sum+frame.hold_frames,0);
 const [position,setPosition]=useState(0);
 const [playing,setPlaying]=useState(false);
 const clock=useRef<{at:number;position:number}|null>(null);
 const frameIndex=ordered.length?Math.max(0,starts.reduce((found,start,index)=>start<=position?index:found,0)):0;
 const current=ordered[frameIndex];
 useEffect(()=>{setPlaying(false);setPosition(0);clock.current=null;},[projectId,frames]);
 useEffect(()=>{
  if(!playing||!total)return;
  clock.current={at:performance.now(),position};
  let raf=0;
  const tick=(now:number)=>{
   const anchor=clock.current;if(!anchor)return;
   const next=anchor.position+Math.floor((now-anchor.at)*FPS/1000);
   if(next>=total){setPosition(total-1);setPlaying(false);clock.current=null;return;}
   setPosition(next);raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);clock.current=null;};
 },[playing,total]);
 function seek(next:number){setPlaying(false);setPosition(Math.max(0,Math.min(total-1,next)));}
 if(!ordered.length)return null;
 const hasImage=current.asset_id&&assets.some(asset=>asset.id===current.asset_id);
 return <section className="animatic-panel" aria-label="Animatic preview">
  <div className="animatic-heading"><div><span className="eyebrow">V0.12 / ANIMATIC</span><h3>Storyboard playback</h3></div><span>{FPS} FPS · {(total/FPS).toFixed(2)}s</span></div>
  <div className="animatic-screen">{hasImage?<img src={assetImageUrl(projectId,current.asset_id!)} alt={current.title}/>:<div className="animatic-placeholder"><Film size={34}/><span>Visual pending</span></div>}<div className="animatic-screen-caption"><span>FRAME {String(current.number).padStart(2,"0")} · {current.title}</span><span>{(position/FPS).toFixed(2)} / {(total/FPS).toFixed(2)}s</span></div></div>
  <div className="animatic-controls"><button type="button" className="secondary-action icon-action" aria-label="Previous frame" onClick={()=>seek(starts[Math.max(0,frameIndex-1)])}><SkipBack size={16}/></button><button type="button" className="primary-action" onClick={()=>{if(position>=total-1)setPosition(0);setPlaying(!playing);}}>{playing?<><Pause size={16}/> Pause</>:<><Play size={16}/> Play</>}</button><button type="button" className="secondary-action icon-action" aria-label="Next frame" onClick={()=>seek(starts[Math.min(starts.length-1,frameIndex+1)])}><SkipForward size={16}/></button><button type="button" className="secondary-action icon-action" aria-label="Restart" onClick={()=>seek(0)}><RotateCcw size={16}/></button></div>
  <input className="animatic-scrubber" aria-label="Seek animatic" type="range" min={0} max={Math.max(0,total-1)} value={position} onChange={e=>seek(Number(e.target.value))}/>
  <div className="animatic-timeline">{ordered.map((frame,index)=><button type="button" key={frame.id} className={"animatic-timeline-item"+(index===frameIndex?" active":"")} style={{flexGrow:frame.hold_frames}} onClick={()=>seek(starts[index])} title={frame.title+" · "+frame.hold_frames+" frames"}><span>{String(frame.number).padStart(2,"0")}</span><small>{frame.hold_frames}f</small></button>)}</div>
 </section>;
}
