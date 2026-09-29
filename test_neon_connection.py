import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    print("❌ 找不到 DATABASE_URL")
    exit(1)

try:
    conn = psycopg2.connect(database_url)

    cursor = conn.cursor()
    cursor.execute("SELECT version();")

    version = cursor.fetchone()[0]

    print("✅ Neon PostgreSQL 連線成功")
    print(version)

    cursor.close()
    conn.close()

except Exception as e:
    print("❌ Neon PostgreSQL 連線失敗")
    print(e)