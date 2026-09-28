import sqlite3

from database.init_db import DATABASE_PATH


conn = sqlite3.connect(DATABASE_PATH)
cursor = conn.cursor()

cursor.execute("""
    SELECT
        city_name,
        township_name,
        geocode,
        latitude,
        longitude
    FROM townships
    ORDER BY township_name
""")

rows = cursor.fetchall()

print(f"SQLite 鄉鎮資料共 {len(rows)} 筆")
print()

for index, row in enumerate(rows, start=1):

    print(
        f"{index} | "
        f"{row[0]} | "
        f"{row[1]} | "
        f"{row[2]} | "
        f"{row[3]} | "
        f"{row[4]}"
    )

conn.close()