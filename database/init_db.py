import sqlite3
from pathlib import Path


# ==========================================
# 專案路徑
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "database"
DATABASE_PATH = DATABASE_DIR / "weather.db"


# ==========================================
# 台灣 22 個縣市座標
# ==========================================

CITY_COORDINATES = {
    "臺北市": (25.0375, 121.5637),
    "新北市": (25.0118, 121.4628),
    "桃園市": (24.9937, 121.3010),
    "臺中市": (24.1477, 120.6736),
    "臺南市": (22.9997, 120.2270),
    "高雄市": (22.6273, 120.3014),

    "基隆市": (25.1276, 121.7392),
    "新竹市": (24.8138, 120.9675),
    "嘉義市": (23.4801, 120.4491),

    "新竹縣": (24.8387, 121.0177),
    "苗栗縣": (24.5602, 120.8214),
    "彰化縣": (24.0518, 120.5161),
    "南投縣": (23.9609, 120.9719),
    "雲林縣": (23.7092, 120.4313),
    "嘉義縣": (23.4518, 120.2555),
    "屏東縣": (22.5519, 120.5487),
    "宜蘭縣": (24.7021, 121.7378),
    "花蓮縣": (23.9911, 121.6112),
    "臺東縣": (22.7554, 121.1500),

    "澎湖縣": (23.5711, 119.5793),
    "金門縣": (24.4493, 118.3767),
    "連江縣": (26.1605, 119.9499),
}


# ==========================================
# 建立 SQLite Connection
# ==========================================

def get_connection():

    DATABASE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    conn = sqlite3.connect(
        DATABASE_PATH
    )

    conn.row_factory = sqlite3.Row

    return conn


# ==========================================
# 初始化 Database
# ==========================================

def init_database():

    conn = get_connection()

    cursor = conn.cursor()

    # ======================================
    # 1. 地區資料
    # ======================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locations (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            location_name TEXT NOT NULL,

            city_name TEXT NOT NULL,

            latitude REAL,

            longitude REAL,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(
                location_name,
                city_name
            )
        )
    """)

    # ======================================
    # 2. 天氣預報資料
    # ======================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weather_forecast (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            location_id INTEGER NOT NULL,

            start_time TEXT NOT NULL,

            end_time TEXT NOT NULL,

            weather TEXT,

            pop INTEGER,

            min_temp INTEGER,

            max_temp INTEGER,

            comfort TEXT,

            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                location_id
            )
            REFERENCES locations(id),

            UNIQUE(
                location_id,
                start_time,
                end_time
            )
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weather_daily_forecast (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL,
            forecast_date TEXT NOT NULL,
            max_temp INTEGER,
            min_temp INTEGER,
            weather TEXT,
            weather_code TEXT,
            pop INTEGER,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (location_id)
                REFERENCES locations(id),
            UNIQUE(
                location_id,
                forecast_date
            )
        )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS townships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_name TEXT NOT NULL,
        township_name TEXT NOT NULL,
        geocode TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(city_name, township_name)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS township_weather_forecast (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        township_id INTEGER NOT NULL,
        forecast_date TEXT NOT NULL,
        max_temp INTEGER,
        min_temp INTEGER,
        weather TEXT,
        weather_code TEXT,
        pop INTEGER,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (township_id)
            REFERENCES townships(id),
        UNIQUE(
            township_id,
            forecast_date
        )
    )
    """)

    # ======================================
    # 4. 更新紀錄
    # ======================================

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS update_log (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            update_time TEXT
                DEFAULT CURRENT_TIMESTAMP,

            source TEXT,

            status TEXT,

            message TEXT
        )
    """)

    # ======================================
    # 建立 / 更新 22 個縣市
    # ======================================

    for city_name, coordinates in CITY_COORDINATES.items():

        latitude, longitude = coordinates

        cursor.execute("""
            INSERT OR IGNORE INTO locations
            (
                location_name,
                city_name,
                latitude,
                longitude
            )
            VALUES (?, ?, ?, ?)
        """, (
            city_name,
            city_name,
            latitude,
            longitude
        ))

        # 如果資料已存在，
        # 確保座標也是最新的
        cursor.execute("""
            UPDATE locations
            SET
                latitude = ?,
                longitude = ?
            WHERE
                location_name = ?
        """, (
            latitude,
            longitude,
            city_name
        ))

    conn.commit()

    conn.close()

    print("Database 初始化完成！")

    print(
        f"Database 路徑：{DATABASE_PATH}"
    )


# ==========================================
# 直接執行此檔案
# ==========================================

if __name__ == "__main__":

    init_database()
