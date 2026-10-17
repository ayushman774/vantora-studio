from logging.config import fileConfig
from alembic import context
from sqlalchemy import pool, create_engine
from app.core.config import Settings
from app.database.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def database_url():
    data_root = Settings().data_root.expanduser().resolve()
    data_root.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(data_root / 'studio.db').as_posix()}"

def run_migrations_offline():
    context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
