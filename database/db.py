import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


# ==========================================
# 資料庫模式
# ==========================================

DATABASE_BACKEND = os.getenv(
    "DATABASE_BACKEND",
    "sqlite"
).lower()


# ==========================================
# SQLite
# ==========================================

def get_sqlite_connection():

    from database.init_db import DATABASE_PATH

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    return conn


# ==========================================
# Neon PostgreSQL
# ==========================================

def get_postgres_connection():

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "找不到 DATABASE_URL，請確認環境變數設定。"
        )

    conn = psycopg2.connect(
        database_url,
        cursor_factory=RealDictCursor
    )

    return conn


# ==========================================
# 統一取得資料庫連線
# ==========================================

def get_db_connection():

    if DATABASE_BACKEND == "postgres":

        return get_postgres_connection()

    return get_sqlite_connection()


def get_db_placeholder():
    """
    取得目前資料庫使用的 SQL 參數佔位符。

    SQLite: ?
    PostgreSQL: %s
    """
    if DATABASE_BACKEND == "postgres":
        return "%s"

    return "?"
