import type {ProductionStatus} from "./sceneTypes";
export type StoryboardFrame={id:string;shot_id:string;asset_id:string|null;number:number;title:string;description:string;composition:string;camera_notes:string;continuity_notes:string;hold_frames:number;status:ProductionStatus;created_at:string;updated_at:string};
export type StoryboardInput=Pick<StoryboardFrame,"number"|"title"|"description"|"composition"|"camera_notes"|"continuity_notes"|"hold_frames"|"status"|"asset_id">;
const root="http://127.0.0.1:8000/api/v1/projects";
const path=(p:string,s:string,e:string,c:string,h:string)=>root+"/"+encodeURIComponent(p)+"/seasons/"+encodeURIComponent(s)+"/episodes/"+encodeURIComponent(e)+"/scenes/"+encodeURIComponent(c)+"/shots/"+encodeURIComponent(h)+"/storyboard-frames";
async function request<T>(url:string,method="GET",data?:object):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(data?{body:JSON.stringify(data)}:{})});}
 catch{throw new Error("Local backend unavailable. Start FastAPI and retry.");}
 if(!response.ok){let detail="Request failed (HTTP "+response.status+")";try{const body:unknown=await response.json();if(body&&typeof body==="object"&&"detail" in body&&typeof body.detail==="string")detail=body.detail;}catch{}throw new Error(detail);}
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listStoryboardFrames=(p:string,s:string,e:string,c:string,h:string)=>request<StoryboardFrame[]>(path(p,s,e,c,h));
export const createStoryboardFrame=(p:string,s:string,e:string,c:string,h:string,data:StoryboardInput)=>request<StoryboardFrame>(path(p,s,e,c,h),"POST",data);
export const updateStoryboardFrame=(p:string,s:string,e:string,c:string,h:string,id:string,data:Partial<StoryboardInput>)=>request<StoryboardFrame>(path(p,s,e,c,h)+"/"+encodeURIComponent(id),"PATCH",data);
export const deleteStoryboardFrame=(p:string,s:string,e:string,c:string,h:string,id:string)=>request<void>(path(p,s,e,c,h)+"/"+encodeURIComponent(id),"DELETE");
