import type {MotionEasing} from "./storyboardApi";

export type AnimationKeyframe={id:string;storyboard_frame_id:string;frame_offset:number;position_x:number;position_y:number;scale:number;rotation:number;opacity:number;easing:MotionEasing;created_at:string;updated_at:string};
export type KeyframeInput=Pick<AnimationKeyframe,"frame_offset"|"position_x"|"position_y"|"scale"|"rotation"|"opacity"|"easing">;
export type KeyframeScope={projectId:string;seasonId:string;episodeId:string;sceneId:string;shotId:string;frameId:string};
const root=(s:KeyframeScope)=>"http://127.0.0.1:8000/api/v1/projects/"+[s.projectId,"seasons",s.seasonId,"episodes",s.episodeId,"scenes",s.sceneId,"shots",s.shotId,"storyboard-frames",s.frameId,"keyframes"].map(encodeURIComponent).join("/");
async function checked(response:Response){if(!response.ok){let message="Animation keyframe error (HTTP "+response.status+")";try{const body:unknown=await response.json();if(body&&typeof body==="object"&&"detail" in body&&typeof body.detail==="string")message=body.detail;}catch{}throw new Error(message);}return response;}
async function request<T>(url:string,method="GET",data?:object):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(data?{body:JSON.stringify(data)}:{})});}
 catch{throw new Error("Local backend unavailable. Start FastAPI and retry.");}
 await checked(response);
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listKeyframes=(s:KeyframeScope)=>request<AnimationKeyframe[]>(root(s));
export const createKeyframe=(s:KeyframeScope,data:KeyframeInput)=>request<AnimationKeyframe>(root(s),"POST",data);
export const updateKeyframe=(s:KeyframeScope,id:string,data:Partial<KeyframeInput>)=>request<AnimationKeyframe>(root(s)+"/"+encodeURIComponent(id),"PATCH",data);
export const deleteKeyframe=(s:KeyframeScope,id:string)=>request<void>(root(s)+"/"+encodeURIComponent(id),"DELETE");
