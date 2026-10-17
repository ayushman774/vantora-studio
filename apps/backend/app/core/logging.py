import logging
from pathlib import Path

def configure_logging(data_root: Path, level: str = "INFO") -> None:
    log_dir = data_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(log_dir / "studio.log", encoding="utf-8")],
        force=True,
    )
