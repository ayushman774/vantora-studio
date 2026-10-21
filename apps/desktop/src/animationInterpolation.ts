import type {AnimationKeyframe} from "./animationKeyframesApi";

export type Transform={position_x:number;position_y:number;scale:number;rotation:number;opacity:number};
export const IDENTITY:Transform={position_x:0,position_y:0,scale:1,rotation:0,opacity:1};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function easing(t:number,kind:AnimationKeyframe["easing"]):number{
 const x=clamp(t);
 return kind==="ease-in"?x*x:kind==="ease-out"?1-(1-x)*(1-x):kind==="ease-in-out"?x*x*(3-2*x):x;
}
export function interpolateKeyframes(keyframes:AnimationKeyframe[],offset:number):Transform{
 if(!keyframes.length)return IDENTITY;
 const sorted=[...keyframes].sort((a,b)=>a.frame_offset-b.frame_offset);
 const first=sorted[0],last=sorted[sorted.length-1];
 if(offset<=first.frame_offset)return pick(first);
 if(offset>=last.frame_offset)return pick(last);
 const index=sorted.findIndex(item=>item.frame_offset>=offset);
 const a=sorted[index-1],b=sorted[index];
 const progress=easing((offset-a.frame_offset)/(b.frame_offset-a.frame_offset),a.easing);
 return {
  position_x:a.position_x+(b.position_x-a.position_x)*progress,
  position_y:a.position_y+(b.position_y-a.position_y)*progress,
  scale:a.scale+(b.scale-a.scale)*progress,
  rotation:a.rotation+(b.rotation-a.rotation)*progress,
  opacity:a.opacity+(b.opacity-a.opacity)*progress,
 };
}
function pick(item:AnimationKeyframe):Transform{
 return {position_x:item.position_x,position_y:item.position_y,scale:item.scale,rotation:item.rotation,opacity:item.opacity};
}
export function cssTransform(value:Transform):string{
 return `translate(${value.position_x}px, ${value.position_y}px) rotate(${value.rotation}deg) scale(${value.scale})`;
}
