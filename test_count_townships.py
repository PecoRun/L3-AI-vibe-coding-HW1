import sqlite3

from database.init_db import DATABASE_PATH


conn = sqlite3.connect(DATABASE_PATH)
cursor = conn.cursor()


# 統計全台鄉鎮數量
cursor.execute("""
    SELECT COUNT(*)
    FROM townships
""")

township_count = cursor.fetchone()[0]


# 統計各縣市鄉鎮數量
cursor.execute("""
    SELECT
        city_name,
        COUNT(*) AS township_count
    FROM townships
    GROUP BY city_name
    ORDER BY city_name
""")

city_rows = cursor.fetchall()


conn.close()


print("=" * 50)
print(f"全台鄉鎮總數：{township_count}")
print("=" * 50)

for city_name, count in city_rows:
    print(
        f"{city_name}：{count} 個鄉鎮"
    )

print("=" * 50)
print(f"縣市數量：{len(city_rows)}")