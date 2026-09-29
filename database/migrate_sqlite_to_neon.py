import sqlite3
import os
import psycopg2
from dotenv import load_dotenv


# ==========================================
# 載入環境變數
# ==========================================

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

SQLITE_PATH = "database/weather.db"


# ==========================================
# 建立 SQLite Connection
# ==========================================

def get_sqlite_connection():

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row

    return conn


# ==========================================
# 建立 Neon Connection
# ==========================================

def get_neon_connection():

    if not DATABASE_URL:
        raise RuntimeError(
            "找不到 DATABASE_URL，請確認 .env 是否設定。"
        )

    return psycopg2.connect(DATABASE_URL)


# ==========================================
# 搬移資料
# ==========================================

def migrate():

    sqlite_conn = get_sqlite_connection()
    neon_conn = get_neon_connection()

    sqlite_cursor = sqlite_conn.cursor()
    neon_cursor = neon_conn.cursor()

    try:

        print("開始 SQLite → Neon 資料搬移...")
        print()

        # ======================================
        # 1. 清除 Neon 舊資料
        # ======================================

        print("清除 Neon 現有資料...")

        neon_cursor.execute(
            "TRUNCATE TABLE "
            "township_weather_forecast, "
            "weather_daily_forecast, "
            "weather_forecast, "
            "townships, "
            "update_log, "
            "locations "
            "RESTART IDENTITY CASCADE"
        )

        # ======================================
        # 2. locations
        # ======================================

        print("搬移 locations...")

        sqlite_cursor.execute("""
            SELECT
                id,
                location_name,
                city_name,
                latitude,
                longitude,
                created_at
            FROM locations
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO locations
                (
                    id,
                    location_name,
                    city_name,
                    latitude,
                    longitude,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                row["id"],
                row["location_name"],
                row["city_name"],
                row["latitude"],
                row["longitude"],
                row["created_at"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # 3. weather_forecast
        # ======================================

        print("搬移 weather_forecast...")

        sqlite_cursor.execute("""
            SELECT
                id,
                location_id,
                start_time,
                end_time,
                weather,
                pop,
                min_temp,
                max_temp,
                comfort,
                updated_at
            FROM weather_forecast
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO weather_forecast
                (
                    id,
                    location_id,
                    start_time,
                    end_time,
                    weather,
                    pop,
                    min_temp,
                    max_temp,
                    comfort,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
            """, (
                row["id"],
                row["location_id"],
                row["start_time"],
                row["end_time"],
                row["weather"],
                row["pop"],
                row["min_temp"],
                row["max_temp"],
                row["comfort"],
                row["updated_at"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # 4. weather_daily_forecast
        # ======================================

        print("搬移 weather_daily_forecast...")

        sqlite_cursor.execute("""
            SELECT
                id,
                location_id,
                forecast_date,
                max_temp,
                min_temp,
                weather,
                weather_code,
                pop,
                updated_at
            FROM weather_daily_forecast
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO weather_daily_forecast
                (
                    id,
                    location_id,
                    forecast_date,
                    max_temp,
                    min_temp,
                    weather,
                    weather_code,
                    pop,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                row["id"],
                row["location_id"],
                row["forecast_date"],
                row["max_temp"],
                row["min_temp"],
                row["weather"],
                row["weather_code"],
                row["pop"],
                row["updated_at"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # 5. townships
        # ======================================

        print("搬移 townships...")

        sqlite_cursor.execute("""
            SELECT
                id,
                city_name,
                township_name,
                geocode,
                latitude,
                longitude,
                updated_at
            FROM townships
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO townships
                (
                    id,
                    city_name,
                    township_name,
                    geocode,
                    latitude,
                    longitude,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                row["id"],
                row["city_name"],
                row["township_name"],
                row["geocode"],
                row["latitude"],
                row["longitude"],
                row["updated_at"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # 6. township_weather_forecast
        # ======================================

        print("搬移 township_weather_forecast...")

        sqlite_cursor.execute("""
            SELECT
                id,
                township_id,
                forecast_date,
                max_temp,
                min_temp,
                weather,
                weather_code,
                pop,
                updated_at
            FROM township_weather_forecast
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO township_weather_forecast
                (
                    id,
                    township_id,
                    forecast_date,
                    max_temp,
                    min_temp,
                    weather,
                    weather_code,
                    pop,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                row["id"],
                row["township_id"],
                row["forecast_date"],
                row["max_temp"],
                row["min_temp"],
                row["weather"],
                row["weather_code"],
                row["pop"],
                row["updated_at"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # 7. update_log
        # ======================================

        print("搬移 update_log...")

        sqlite_cursor.execute("""
            SELECT
                id,
                update_time,
                source,
                status,
                message
            FROM update_log
            ORDER BY id
        """)

        rows = sqlite_cursor.fetchall()

        for row in rows:

            neon_cursor.execute("""
                INSERT INTO update_log
                (
                    id,
                    update_time,
                    source,
                    status,
                    message
                )
                VALUES (
                    %s, %s, %s, %s, %s
                )
            """, (
                row["id"],
                row["update_time"],
                row["source"],
                row["status"],
                row["message"]
            ))

        print(f"  → {len(rows)} 筆")

        # ======================================
        # Commit
        # ======================================

        neon_conn.commit()

        print()
        print("==========================================")
        print("SQLite → Neon 資料搬移完成！")
        print("==========================================")

    except Exception as e:

        neon_conn.rollback()

        print()
        print("❌ 資料搬移失敗")
        print(e)

        raise

    finally:

        sqlite_cursor.close()
        sqlite_conn.close()

        neon_cursor.close()
        neon_conn.close()


# ==========================================
# 執行
# ==========================================

if __name__ == "__main__":

    migrate()