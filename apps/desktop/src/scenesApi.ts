import type { Scene, Shot } from "./sceneTypes";
const root = "http://127.0.0.1:8000/api/v1/projects";
const epPath = (p: string, s: string, e: string) => [p,s,e].map(encodeURIComponent).join("/");
const base = (p:string,s:string,e:string) => root+"/"+encodeURIComponent(p)+"/seasons/"+encodeURIComponent(s)+"/episodes/"+encodeURIComponent(e)+"/scenes";
async function call<T>(url:string, method="GET", data?:object):Promise<T>{
  let response:Response;
  try { response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(data?{body:JSON.stringify(data)}:{})}); }
  catch {throw new Error("Local backend unavailable. Start FastAPI and retry.");}
  if(!response.ok){let detail="Request failed (HTTP "+response.status+")";try{const body=await response.json();if(typeof body?.detail==="string")detail=body.detail;}catch{}throw new Error(detail);}
  return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listScenes=(p:string,s:string,e:string)=>call<Scene[]>(base(p,s,e));
export const createScene=(p:string,s:string,e:string,data:object)=>call<Scene>(base(p,s,e),"POST",data);
export const updateScene=(p:string,s:string,e:string,id:string,data:object)=>call<Scene>(base(p,s,e)+"/"+encodeURIComponent(id),"PATCH",data);
export const deleteScene=(p:string,s:string,e:string,id:string)=>call<void>(base(p,s,e)+"/"+encodeURIComponent(id),"DELETE");
const shotBase=(p:string,s:string,e:string,id:string)=>base(p,s,e)+"/"+encodeURIComponent(id)+"/shots";
export const listShots=(p:string,s:string,e:string,id:string)=>call<Shot[]>(shotBase(p,s,e,id));
export const createShot=(p:string,s:string,e:string,id:string,data:object)=>call<Shot>(shotBase(p,s,e,id),"POST",data);
export const updateShot=(p:string,s:string,e:string,id:string,shot:string,data:object)=>call<Shot>(shotBase(p,s,e,id)+"/"+encodeURIComponent(shot),"PATCH",data);
export const deleteShot=(p:string,s:string,e:string,id:string,shot:string)=>call<void>(shotBase(p,s,e,id)+"/"+encodeURIComponent(shot),"DELETE");
