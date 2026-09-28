from services.cwa_api import fetch_weekly_weather_data
from services.weather_service import save_township_data


print("開始取得臺中市鄉鎮資料...")

data = fetch_weekly_weather_data()

print("CWA 資料取得成功")

save_township_data(data)

print("SQLite 儲存完成")