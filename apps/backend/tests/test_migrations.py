from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

def test_migrations_upgrade_repeatable_and_downgrade(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_ROOT", str(tmp_path / "studio-data"))
    backend_root = Path(__file__).resolve().parents[1]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    engine = create_engine(f"sqlite:///{(tmp_path / 'studio-data' / 'studio.db').as_posix()}")
    try:
        assert {"studio_metadata", "alembic_version"}.issubset(set(inspect(engine).get_table_names()))
    finally:
        engine.dispose()
    command.downgrade(config, "base")
    engine = create_engine(f"sqlite:///{(tmp_path / 'studio-data' / 'studio.db').as_posix()}")
    try:
        assert "studio_metadata" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()
