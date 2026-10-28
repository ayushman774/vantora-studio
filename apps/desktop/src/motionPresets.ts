import type {KeyframeInput} from "./animationKeyframesApi";
export type MotionPreset="slide-in"|"slide-out"|"zoom-in"|"zoom-out"|"fade-in"|"fade-out"|"rotate";
type Transform=Pick<KeyframeInput,"position_x"|"position_y"|"scale"|"rotation"|"opacity">;
const limit=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function buildMotionPreset(preset:MotionPreset,start:number,end:number,base:Transform):[KeyframeInput,KeyframeInput]{
 if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start)throw new Error("Preset needs at least two different frames.");
 const first:KeyframeInput={...base,frame_offset:start,easing:"ease-in-out"};
 const last:KeyframeInput={...base,frame_offset:end,easing:"ease-in-out"};
 switch(preset){
  case "slide-in":first.position_x=limit(base.position_x-500,-10000,10000);break;
  case "slide-out":last.position_x=limit(base.position_x+500,-10000,10000);break;
  case "zoom-in":first.scale=limit(base.scale*0.5,0.001,10);break;
  case "zoom-out":last.scale=limit(base.scale*0.5,0.001,10);break;
  case "fade-in":first.opacity=0;break;
  case "fade-out":last.opacity=0;break;
  case "rotate":last.rotation=limit(base.rotation+90,-3600,3600);break;
 }
 return [first,last];
}
