import type {KeyframeScope} from "./animationKeyframesApi";

export type VisualLayer = {
  id:string; storyboard_frame_id:string; asset_id:string; name:string;
  layer_order:number; position_x:number; position_y:number; scale:number;
  rotation:number; opacity:number; visible:boolean;
  created_at:string; updated_at:string;
};
export type VisualLayerInput = Pick<VisualLayer,
  "asset_id"|"name"|"layer_order"|"position_x"|"position_y"|"scale"|"rotation"|"opacity"|"visible">;

function endpoint(s:KeyframeScope):string {
  const parts=[s.projectId,"seasons",s.seasonId,"episodes",s.episodeId,"scenes",
    s.sceneId,"shots",s.shotId,"storyboard-frames",s.frameId,"layers"];
  return "http://127.0.0.1:8000/api/v1/projects/"+parts.map(encodeURIComponent).join("/");
}
async function request<T>(url:string,method="GET",data?:object):Promise<T> {
  let response:Response;
  try {
    response=await fetch(url,{method,headers:{"Content-Type":"application/json"},
      ...(data?{body:JSON.stringify(data)}:{})});
  } catch {
    throw new Error("Local backend unavailable. Start FastAPI and retry.");
  }
  if (!response.ok) {
    let message="Visual layer request failed (HTTP "+response.status+")";
    try {
      const payload:unknown=await response.json();
      if (payload && typeof payload==="object" && "detail" in payload &&
          typeof payload.detail==="string") message=payload.detail;
    } catch { /* use HTTP status */ }
    throw new Error(message);
  }
  return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listVisualLayers=(s:KeyframeScope)=>request<VisualLayer[]>(endpoint(s));
export const createVisualLayer=(s:KeyframeScope,data:VisualLayerInput)=>request<VisualLayer>(endpoint(s),"POST",data);
export const updateVisualLayer=(s:KeyframeScope,id:string,data:Partial<VisualLayerInput>)=>
  request<VisualLayer>(endpoint(s)+"/"+encodeURIComponent(id),"PATCH",data);
export const deleteVisualLayer=(s:KeyframeScope,id:string)=>
  request<void>(endpoint(s)+"/"+encodeURIComponent(id),"DELETE");
