from services.cwa_api import fetch_township_weather_data
from services.weather_service import (
    save_township_weather
)


print("開始取得臺中市鄉鎮天氣資料...")


data = fetch_township_weather_data(
    "F-D0047-073"
)


print("CWA 資料取得成功")


save_township_weather(data)