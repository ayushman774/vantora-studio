import {useState,useRef,type PointerEvent} from "react";
import type {VisualLayer} from "./visualLayersApi";
import type {LayerKeyframe} from "./layerKeyframesApi";

type Props={
 layers:VisualLayer[];
 keyframes:Record<string,LayerKeyframe[]>;
 holdFrames:number;
 playhead:number;
 selectedLayerId:string|null;
 onSeek:(frame:number)=>void;
 onSelectLayer:(id:string)=>void;
 onSelectKeyframe:(layerId:string,point:LayerKeyframe)=>void;
 onMoveKeyframe:(layerId:string,point:LayerKeyframe,targetFrame:number)=>Promise<void>;
 busy:boolean;
};
export default function LayerTimeline({layers,keyframes,holdFrames,playhead,selectedLayerId,onSeek,onSelectLayer,onSelectKeyframe,onMoveKeyframe,busy}:Props){
 const duration=Math.max(1,holdFrames-1);
 const [drag,setDrag]=useState<{layerId:string;point:LayerKeyframe;frame:number;originX:number;moved:boolean}|null>(null);
 const dragRef=useRef<typeof drag>(null);
 const toFrame=(event:PointerEvent<HTMLButtonElement>)=>{
  const track=event.currentTarget.parentElement;
  if(!track)return 0;
  const rect=track.getBoundingClientRect();
  return Math.max(0,Math.min(duration,Math.round((event.clientX-rect.left)/rect.width*duration)));
 };
 const startDrag=(event:PointerEvent<HTMLButtonElement>,layerId:string,point:LayerKeyframe)=>{
  if(busy||event.button!==0)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  const next={layerId,point,frame:point.frame_offset,originX:event.clientX,moved:false};
  dragRef.current=next;setDrag(next);
 };
 const moveDrag=(event:PointerEvent<HTMLButtonElement>)=>{
  const current=dragRef.current;if(!current)return;
  if(Math.abs(event.clientX-current.originX)<4&&!current.moved)return;
  const next={...current,frame:toFrame(event),moved:true};
  dragRef.current=next;setDrag(next);seek(next.frame);
 };
 const finishDrag=(event:PointerEvent<HTMLButtonElement>)=>{
  const current=dragRef.current;if(!current)return;
  dragRef.current=null;setDrag(null);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(!current.moved){seek(current.point.frame_offset);onSelectKeyframe(current.layerId,current.point);return;}
  const occupied=(keyframes[current.layerId]??[]).some(item=>item.id!==current.point.id&&item.frame_offset===current.frame);
  if(occupied||current.frame===current.point.frame_offset)return;
  void onMoveKeyframe(current.layerId,current.point,current.frame);
 };
 const cancelDrag=()=>{dragRef.current=null;setDrag(null);};
 const marks=Array.from(new Set([0,Math.round(duration/4),Math.round(duration/2),Math.round(duration*3/4),duration]));
 const seek=(value:number)=>onSeek(Math.max(0,Math.min(duration,Math.round(value))));
 return <section className="lt-panel" aria-label="Layer animation timeline">
  <div className="lt-header"><div><span className="eyebrow">V0.18 / ANIMATION</span><h3>Layer timeline</h3></div>
   <span className="lt-timecode">Frame {playhead} / {duration} <small>· {(playhead/24).toFixed(2)}s</small></span></div>
  <div className="lt-scrub"><label htmlFor="lt-playhead">Scrub animation</label>
   <input id="lt-playhead" aria-label="Animation playhead" type="range" min={0} max={duration} step={1} value={playhead} onChange={event=>seek(Number(event.target.value))}/>
   <div className="lt-ticks">{marks.map(frame=><span key={frame}>{frame}</span>)}</div></div>
  <div className="lt-tracks">
   {[...layers].reverse().map(layer=><div key={layer.id} className={"lt-row"+(selectedLayerId===layer.id?" selected":"")}>
    <button type="button" className="lt-track-label" onClick={()=>onSelectLayer(layer.id)} aria-pressed={selectedLayerId===layer.id} title={layer.name}>{layer.name}<small>{(keyframes[layer.id]??[]).length} keyframes</small></button>
    <div className="lt-track" aria-label={layer.name+" keyframe track"}>
     <div className="lt-playhead" style={{left:(playhead/duration*100)+"%"}} aria-hidden="true"/>
     {(keyframes[layer.id]??[]).map(point=><button type="button" key={point.id} className="lt-marker" style={{left:((drag?.point.id===point.id&&drag.layerId===layer.id?drag.frame:point.frame_offset)/duration*100)+"%"}} title={layer.name+" · Frame "+point.frame_offset} aria-label={layer.name+" keyframe at frame "+point.frame_offset} disabled={busy} onPointerDown={event=>startDrag(event,layer.id,point)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}><span/></button>)}
    </div>
   </div>)}
  </div>
  <p className="lt-hint">Click a diamond to edit, or drag it to a new frame. Movement snaps to whole frames; occupied frames cannot be overwritten.</p>
 </section>;
}
