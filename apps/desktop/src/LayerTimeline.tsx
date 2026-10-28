import type {VisualLayer} from "./visualLayersApi";
import type {LayerKeyframe} from "./layerKeyframesApi";

type Props={
 layers:VisualLayer[];
 keyframes:Record<string,LayerKeyframe[]>;
 holdFrames:number;
 playhead:number;
 selectedLayerId:string|null;
 onSeek:(frame:number)=>void;
 onSelectLayer:(id:string)=>void;
 onSelectKeyframe:(layerId:string,point:LayerKeyframe)=>void;
};
export default function LayerTimeline({layers,keyframes,holdFrames,playhead,selectedLayerId,onSeek,onSelectLayer,onSelectKeyframe}:Props){
 const duration=Math.max(1,holdFrames-1);
 const marks=Array.from(new Set([0,Math.round(duration/4),Math.round(duration/2),Math.round(duration*3/4),duration]));
 const seek=(value:number)=>onSeek(Math.max(0,Math.min(duration,Math.round(value))));
 return <section className="lt-panel" aria-label="Layer animation timeline">
  <div className="lt-header"><div><span className="eyebrow">V0.18 / ANIMATION</span><h3>Layer timeline</h3></div>
   <span className="lt-timecode">Frame {playhead} / {duration} <small>· {(playhead/24).toFixed(2)}s</small></span></div>
  <div className="lt-scrub"><label htmlFor="lt-playhead">Scrub animation</label>
   <input id="lt-playhead" aria-label="Animation playhead" type="range" min={0} max={duration} step={1} value={playhead} onChange={event=>seek(Number(event.target.value))}/>
   <div className="lt-ticks">{marks.map(frame=><span key={frame}>{frame}</span>)}</div></div>
  <div className="lt-tracks">
   {[...layers].reverse().map(layer=><div key={layer.id} className={"lt-row"+(selectedLayerId===layer.id?" selected":"")}>
    <button type="button" className="lt-track-label" onClick={()=>onSelectLayer(layer.id)} aria-pressed={selectedLayerId===layer.id} title={layer.name}>{layer.name}<small>{(keyframes[layer.id]??[]).length} keyframes</small></button>
    <div className="lt-track" aria-label={layer.name+" keyframe track"}>
     <div className="lt-playhead" style={{left:(playhead/duration*100)+"%"}} aria-hidden="true"/>
     {(keyframes[layer.id]??[]).map(point=><button type="button" key={point.id} className="lt-marker" style={{left:(point.frame_offset/duration*100)+"%"}} title={layer.name+" · Frame "+point.frame_offset} aria-label={layer.name+" keyframe at frame "+point.frame_offset} onClick={()=>{seek(point.frame_offset);onSelectKeyframe(layer.id,point);}}><span/></button>)}
    </div>
   </div>)}
  </div>
  <p className="lt-hint">Select a layer track or a diamond keyframe to edit its properties. Scrubbing previews the animation without saving changes.</p>
 </section>;
}
