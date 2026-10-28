import type {KeyframeScope,KeyframeInput} from "./animationKeyframesApi";
import type {MotionEasing} from "./storyboardApi";
export type LayerKeyframe=KeyframeInput&{id:string;visual_layer_id:string;created_at:string;updated_at:string;easing:MotionEasing};
const root=(s:KeyframeScope,layerId:string)=>"http://127.0.0.1:8000/api/v1/projects/"+[s.projectId,"seasons",s.seasonId,"episodes",s.episodeId,"scenes",s.sceneId,"shots",s.shotId,"storyboard-frames",s.frameId,"layers",layerId,"keyframes"].map(encodeURIComponent).join("/");
async function request<T>(url:string,method="GET",data?:object):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(data?{body:JSON.stringify(data)}:{})});}
 catch{throw new Error("Local backend unavailable. Start FastAPI and retry.");}
 if(!response.ok){let message="Layer keyframe request failed (HTTP "+response.status+")";try{const body:unknown=await response.json();if(body&&typeof body==="object"&&"detail" in body){
 const detail=body.detail;
 if(typeof detail==="string")message=detail;
 else if(Array.isArray(detail))message=detail.map((issue:unknown)=>{
  if(issue&&typeof issue==="object"&&"msg" in issue){
   const field="loc" in issue&&Array.isArray(issue.loc)?issue.loc.join("."):"keyframe";
   return field+": "+String(issue.msg);
  }
  return JSON.stringify(issue);
 }).join("; ");
}}catch{/* preserve status */}throw new Error(message);}
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listLayerKeyframes=(s:KeyframeScope,id:string)=>request<LayerKeyframe[]>(root(s,id));
export const createLayerKeyframe=(s:KeyframeScope,id:string,data:KeyframeInput)=>request<LayerKeyframe>(root(s,id),"POST",data);
export const updateLayerKeyframe=(s:KeyframeScope,id:string,keyframeId:string,data:Partial<KeyframeInput>)=>request<LayerKeyframe>(root(s,id)+"/"+encodeURIComponent(keyframeId),"PATCH",data);
export const deleteLayerKeyframe=(s:KeyframeScope,id:string,keyframeId:string)=>request<void>(root(s,id)+"/"+encodeURIComponent(keyframeId),"DELETE");
