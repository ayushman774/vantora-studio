export type AudioClip={id:string;shot_id:string;audio_asset_id:string;start_frame:number;duration_frames:number;volume:number;muted:boolean;created_at:string;updated_at:string};
export type AudioClipInput=Pick<AudioClip,"audio_asset_id"|"start_frame"|"duration_frames"|"volume"|"muted">;
export type ShotAudioScope={projectId:string;seasonId:string;episodeId:string;sceneId:string;shotId:string};
const root=(s:ShotAudioScope)=>"http://127.0.0.1:8000/api/v1/projects/"+[s.projectId,"seasons",s.seasonId,"episodes",s.episodeId,"scenes",s.sceneId,"shots",s.shotId,"audio-clips"].map(encodeURIComponent).join("/");
async function checked(r:Response){if(!r.ok){let message=`Audio timeline error (HTTP ${r.status})`;try{const body=await r.json();if(typeof body.detail==="string")message=body.detail;}catch{}throw new Error(message);}return r;}
export async function listAudioClips(s:ShotAudioScope):Promise<AudioClip[]>{return (await checked(await fetch(root(s)))).json();}
export async function addAudioClip(s:ShotAudioScope,data:AudioClipInput):Promise<AudioClip>{return (await checked(await fetch(root(s),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}))).json();}
export async function editAudioClip(s:ShotAudioScope,id:string,data:Partial<AudioClipInput>):Promise<AudioClip>{return (await checked(await fetch(root(s)+"/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}))).json();}
export async function removeAudioClip(s:ShotAudioScope,id:string):Promise<void>{await checked(await fetch(root(s)+"/"+encodeURIComponent(id),{method:"DELETE"}));}
