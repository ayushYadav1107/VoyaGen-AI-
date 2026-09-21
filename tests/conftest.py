"""Import backend with the DB pool and Groq client stubbed out, so tests need no network."""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

os.environ.update(DATABASE_URL="postgresql://u:p@localhost/db", GROQ_API_KEY="test")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg_pool
import langgraph.checkpoint.postgres as pg

psycopg_pool.ConnectionPool = MagicMock()
from langgraph.checkpoint.memory import InMemorySaver

pg.PostgresSaver = lambda pool: InMemorySaver()
InMemorySaver.setup = lambda self: None
