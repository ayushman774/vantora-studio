"""v0.17 visual layer API ownership, ordering and validation."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.config import Settings
from app.database.models import Base, Project, Season, Episode, Scene, Shot, StoryboardFrame, Asset
from app.main import create_app

def test_visual_layers_scoped_crud(tmp_path):
    app=create_app(Settings(data_root=tmp_path))
    engine=create_engine("sqlite://", connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now=datetime.now(timezone.utc)
    with Session(engine) as db:
        for p in ("p1","p2"):
            db.add(Project(id=p,name="Test",description="",project_type="anime",created_at=now,updated_at=now))
            db.add(Season(id="s"+p,project_id=p,number=1,title="Season",description="",created_at=now,updated_at=now))
            db.add(Episode(id="e"+p,season_id="s"+p,number=1,title="Episode",synopsis="",created_at=now,updated_at=now))
            db.add(Scene(id="c"+p,episode_id="e"+p,number=1,title="Scene",description="",location="",time_of_day="",status="draft",created_at=now,updated_at=now))
            db.add(Shot(id="h"+p,scene_id="c"+p,number=1,title="Shot",description="",camera="",action="",duration_frames=48,status="draft",created_at=now,updated_at=now))
            db.add(StoryboardFrame(id="f"+p,shot_id="h"+p,number=1,title="Frame",description="",composition="",camera_notes="",continuity_notes="",hold_frames=48,created_at=now,updated_at=now))
            db.add(Asset(id="a"+p,project_id=p,category="character",title="Art",original_name="art.png",filename=p+".png",media_type="image/png",size_bytes=100,sha256="0"*64,created_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine=engine
        root="/api/v1/projects/p1/seasons/sp1/episodes/ep1/scenes/cp1/shots/hp1/storyboard-frames/fp1/layers"
        foreign="/api/v1/projects/p2/seasons/sp2/episodes/ep2/scenes/cp2/shots/hp2/storyboard-frames/fp2/layers"
        assert client.post(root,json={"name":"Wrong project","asset_id":"ap2","layer_order":0}).status_code==422
        assert client.post(root,json={"name":" ","asset_id":"ap1","layer_order":0}).status_code==422
        created=client.post(root,json={"name":"Character","asset_id":"ap1","layer_order":1,"position_x":50})
        assert created.status_code==201,created.text
        lid=created.json()["id"]
        assert client.get(root+"/"+lid).json()["position_x"]==50
        assert client.post(root,json={"name":"Duplicate","asset_id":"ap1","layer_order":1}).status_code==409
        assert client.post(root,json={"name":"Bad","asset_id":"ap1","layer_order":2,"opacity":2}).status_code==422
        assert client.post(root,json={"name":"Background","asset_id":"ap1","layer_order":0}).status_code==201
        assert [layer["layer_order"] for layer in client.get(root).json()]==[0,1]
        assert client.get(foreign+"/"+lid).status_code==404
        assert client.patch(foreign+"/"+lid,json={"name":"Hijacked"}).status_code==404
        assert client.patch(root+"/"+lid,json={"asset_id":"ap2"}).status_code==422
        assert client.patch(root+"/"+lid,json={"visible":False,"opacity":0.4}).json()["visible"] is False
        assert client.delete(root+"/"+lid).status_code==204
        assert client.get(root+"/"+lid).status_code==404


def test_layer_keyframes_scoped_crud_and_bounds(tmp_path):
    app=create_app(Settings(data_root=tmp_path))
    engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now=datetime.now(timezone.utc)
    with Session(engine) as db:
        db.add(Project(id="p",name="Test",description="",project_type="anime",created_at=now,updated_at=now))
        db.add(Season(id="s",project_id="p",number=1,title="Season",description="",created_at=now,updated_at=now))
        db.add(Episode(id="e",season_id="s",number=1,title="Episode",synopsis="",created_at=now,updated_at=now))
        db.add(Scene(id="c",episode_id="e",number=1,title="Scene",description="",location="",time_of_day="",status="draft",created_at=now,updated_at=now))
        db.add(Shot(id="h",scene_id="c",number=1,title="Shot",description="",camera="",action="",duration_frames=48,status="draft",created_at=now,updated_at=now))
        db.add(StoryboardFrame(id="f",shot_id="h",number=1,title="Frame",description="",composition="",camera_notes="",continuity_notes="",hold_frames=48,created_at=now,updated_at=now))
        db.add(Asset(id="a",project_id="p",category="character",title="Art",original_name="art.png",filename="a.png",media_type="image/png",size_bytes=100,sha256="0"*64,created_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine=engine
        root="/api/v1/projects/p/seasons/s/episodes/e/scenes/c/shots/h/storyboard-frames/f/layers"
        layer=client.post(root,json={"asset_id":"a","name":"Hero","layer_order":0})
        assert layer.status_code==201,layer.text
        lid=layer.json()["id"]
        endpoint=root+"/"+lid+"/keyframes"
        assert client.post(endpoint,json={"frame_offset":48}).status_code==422
        created=client.post(endpoint,json={"frame_offset":0,"position_x":-300})
        assert created.status_code==201,created.text
        kid=created.json()["id"]
        assert client.post(endpoint,json={"frame_offset":0}).status_code==409
        assert client.post(endpoint,json={"frame_offset":47,"position_x":200}).status_code==201
        assert [item["frame_offset"] for item in client.get(endpoint).json()]==[0,47]
        assert client.patch(endpoint+"/"+kid,json={"position_x":-200}).json()["position_x"]==-200
        assert client.patch(endpoint+"/"+kid,json={"frame_offset":48}).status_code==422
        assert client.get(root+"/missing/keyframes").status_code==404
        assert client.get(root+"/missing/keyframes/"+kid).status_code==404
        assert client.delete(endpoint+"/"+kid).status_code==204
        assert client.get(endpoint+"/"+kid).status_code==404
