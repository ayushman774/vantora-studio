export type AudioCategory = "music" | "sound_effect" | "voice";
export type AudioAsset = {id:string;project_id:string;category:AudioCategory;title:string;original_name:string;media_type:string;size_bytes:number;sha256:string;created_at:string};
const base=(projectId:string)=>`http://127.0.0.1:8000/api/v1/projects/${encodeURIComponent(projectId)}/audio-assets`;
async function checked(response:Response){
 if(!response.ok){let detail=`Audio request failed (HTTP ${response.status})`;try{const body=await response.json();if(typeof body.detail==="string")detail=body.detail;}catch{}throw new Error(detail);}
 return response;
}
export const audioFileUrl=(projectId:string,id:string)=>`${base(projectId)}/${encodeURIComponent(id)}/file`;
export async function listAudio(projectId:string):Promise<AudioAsset[]>{return (await checked(await fetch(base(projectId)))).json();}
export async function uploadAudio(projectId:string,file:File,category:AudioCategory):Promise<AudioAsset>{
 return (await checked(await fetch(`${base(projectId)}?category=${encodeURIComponent(category)}`,{method:"POST",headers:{"Content-Type":file.type==="audio/x-wav"?"audio/wav":file.type,"X-Filename":encodeURIComponent(file.name)},body:file}))).json();
}
export async function updateAudio(projectId:string,id:string,data:{title?:string;category?:AudioCategory}):Promise<AudioAsset>{
 return (await checked(await fetch(`${base(projectId)}/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}))).json();
}
export async function deleteAudio(projectId:string,id:string):Promise<void>{await checked(await fetch(`${base(projectId)}/${encodeURIComponent(id)}`,{method:"DELETE"}));}
