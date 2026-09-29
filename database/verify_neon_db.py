import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def main():

    if not DATABASE_URL:
        print("❌ 找不到 DATABASE_URL")
        return

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    tables = [
        "locations",
        "weather_forecast",
        "weather_daily_forecast",
        "townships",
        "township_weather_forecast",
        "update_log"
    ]

    print("==========================================")
    print("Neon PostgreSQL 資料驗證")
    print("==========================================")

    total = 0

    for table in tables:

        cursor.execute(
            f"SELECT COUNT(*) FROM {table}"
        )

        count = cursor.fetchone()[0]

        total += count

        print(f"{table:<30} {count:>6} 筆")

    print("------------------------------------------")
    print(f"{'TOTAL':<30} {total:>6} 筆")
    print("==========================================")

    # --------------------------------------
    # 驗證 locations
    # --------------------------------------

    print()
    print("前 5 筆 locations：")

    cursor.execute("""
        SELECT
            id,
            city_name,
            location_name,
            latitude,
            longitude
        FROM locations
        ORDER BY id
        LIMIT 5
    """)

    for row in cursor.fetchall():
        print(row)

    # --------------------------------------
    # 驗證 townships
    # --------------------------------------

    print()
    print("前 5 筆 townships：")

    cursor.execute("""
        SELECT
            id,
            city_name,
            township_name,
            geocode,
            latitude,
            longitude
        FROM townships
        ORDER BY id
        LIMIT 5
    """)

    for row in cursor.fetchall():
        print(row)

    # --------------------------------------
    # 驗證天氣資料 JOIN
    # --------------------------------------

    print()
    print("鄉鎮天氣 JOIN 驗證：")

    cursor.execute("""
        SELECT
            t.city_name,
            t.township_name,
            w.forecast_date,
            w.max_temp,
            w.min_temp,
            w.weather,
            w.pop
        FROM township_weather_forecast w
        JOIN townships t
            ON w.township_id = t.id
        ORDER BY t.id, w.forecast_date
        LIMIT 5
    """)

    for row in cursor.fetchall():
        print(row)

    cursor.close()
    conn.close()

    print()
    print("✅ Neon 資料驗證完成")


if __name__ == "__main__":
    main()