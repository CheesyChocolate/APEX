import logging
import sys
from logging.handlers import RotatingFileHandler

from app.core.config import LOG_FILE, LOG_LEVEL

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)

_file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3)
_file_handler.setFormatter(_fmt)

_stream_handler = logging.StreamHandler(sys.stdout)
_stream_handler.setFormatter(_fmt)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(_level)
        logger.addHandler(_file_handler)
        logger.addHandler(_stream_handler)
        logger.propagate = False
    return logger
