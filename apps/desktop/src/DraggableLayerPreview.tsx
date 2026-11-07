import {useRef,useState,type PointerEvent} from "react";
import {interpolateKeyframes} from "./animationInterpolation";
import type {LayerKeyframe} from "./layerKeyframesApi";
import type {VisualLayerInput} from "./visualLayersApi";

type Props={
 imageUrl:string;draft:VisualLayerInput;points:LayerKeyframe[];frame:number;busy:boolean;
 onPosition:(x:number,y:number)=>Promise<void>;
};
const PREVIEW_SCALE=8;
const clamp=(value:number)=>Math.max(-10000,Math.min(10000,value));
export default function DraggableLayerPreview({imageUrl,draft,points,frame,busy,onPosition}:Props){
 const [offset,setOffset]=useState<{x:number;y:number}|null>(null);
 const drag=useRef<{pointerId:number;startX:number;startY:number;x:number;y:number;active:boolean}|null>(null);
 const motion=points.length?interpolateKeyframes(points,frame):draft;
 const x=offset?.x??motion.position_x;
 const y=offset?.y??motion.position_y;
 const start=(event:PointerEvent<HTMLImageElement>)=>{
  if(busy||event.button!==0)return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:motion.position_x,y:motion.position_y,active:false};
 };
 const move=(event:PointerEvent<HTMLImageElement>)=>{
  const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
  const dx=event.clientX-current.startX,dy=event.clientY-current.startY;
  if(!current.active&&Math.hypot(dx,dy)<3)return;
  current.active=true;
  setOffset({x:clamp(Math.round(current.x+dx*PREVIEW_SCALE)),y:clamp(Math.round(current.y+dy*PREVIEW_SCALE))});
 };
 const finish=(event:PointerEvent<HTMLImageElement>)=>{
  const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(!current.active){setOffset(null);return;}
  const dx=event.clientX-current.startX,dy=event.clientY-current.startY;
  const nextX=clamp(Math.round(current.x+dx*PREVIEW_SCALE));
  const nextY=clamp(Math.round(current.y+dy*PREVIEW_SCALE));
  setOffset(null);
  if(nextX!==current.x||nextY!==current.y)void onPosition(nextX,nextY);
 };
 const cancel=()=>{drag.current=null;setOffset(null);};
 return <div className="vl-preview vl-draggable-preview">
  {draft.visible?<img src={imageUrl} alt="Drag selected artwork to position at current frame" draggable={false}
   onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}
   style={{transform:`translate(${x/PREVIEW_SCALE}px,${y/PREVIEW_SCALE}px) rotate(${motion.rotation}deg) scale(${motion.scale})`,opacity:motion.opacity,touchAction:"none",cursor:busy?"wait":"grab"}}/>:<span>Layer hidden</span>}
  <div className="vl-preview-caption">Frame {frame} · X {x} · Y {y}{busy?" · Saving…":""}</div>
 </div>;
}
