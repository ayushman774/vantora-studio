export type ProductionStatus = "draft"|"planned"|"in_progress"|"review"|"approved";
export type Scene = {id:string;episode_id:string;number:number;title:string;description:string;location:string;time_of_day:string;status:ProductionStatus;created_at:string;updated_at:string};
export type Shot = {id:string;scene_id:string;number:number;title:string;description:string;camera:string;action:string;duration_frames:number;status:ProductionStatus;created_at:string;updated_at:string};
