from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import Engine

def make_session_factory(engine: Engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
