from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine


def build_engine(data_root: Path) -> Engine:
    data_root.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{(data_root / 'studio.db').as_posix()}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def sqlite_setup(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    return engine
