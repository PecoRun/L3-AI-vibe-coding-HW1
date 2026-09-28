from datetime import datetime

from services.cwa_api import fetch_weekly_weather_data


# ==========================================
# 取得 CWA 一週天氣資料
# ==========================================

data = fetch_weekly_weather_data()

locations = data["records"]["Locations"][0]["Location"]


# ==========================================
# 找到臺中市
# ==========================================

taichung = None

for location in locations:

    if location["LocationName"] == "臺中市":
        taichung = location
        break


if not taichung:
    print("找不到臺中市")
    exit()


print("=" * 60)
print("找到臺中市")
print("=" * 60)

print("LocationName:", taichung["LocationName"])
print("Geocode:", taichung["Geocode"])


# ==========================================
# 將 WeatherElement 整理成 Dictionary
# ==========================================

weather_elements = {}

for element in taichung["WeatherElement"]:

    element_name = element["ElementName"]

    weather_elements[element_name] = element["Time"]


# ==========================================
# 取得需要的資料
# ==========================================

max_temp_data = weather_elements["最高溫度"]
min_temp_data = weather_elements["最低溫度"]
pop_data = weather_elements["12小時降雨機率"]
weather_data = weather_elements["天氣現象"]


# ==========================================
# 建立每日資料
# ==========================================

daily_data = {}


# ==========================================
# 處理最高溫 / 最低溫
# ==========================================

for item in max_temp_data:

    start_time = item["StartTime"]
    end_time = item["EndTime"]

    # 使用 EndTime 的日期作為預報日期
    forecast_date = end_time[:10]

    value = item["ElementValue"][0]["MaxTemperature"]

    if value == "-":
        continue

    value = int(value)

    if forecast_date not in daily_data:

        daily_data[forecast_date] = {
            "max_temp": None,
            "min_temp": None,
            "weather": None,
            "weather_code": None,
            "pop": None
        }

    current_max = daily_data[forecast_date]["max_temp"]

    if current_max is None or value > current_max:
        daily_data[forecast_date]["max_temp"] = value


for item in min_temp_data:

    end_time = item["EndTime"]

    forecast_date = end_time[:10]

    value = item["ElementValue"][0]["MinTemperature"]

    if value == "-":
        continue

    value = int(value)

    if forecast_date not in daily_data:

        daily_data[forecast_date] = {
            "max_temp": None,
            "min_temp": None,
            "weather": None,
            "weather_code": None,
            "pop": None
        }

    current_min = daily_data[forecast_date]["min_temp"]

    if current_min is None or value < current_min:
        daily_data[forecast_date]["min_temp"] = value


# ==========================================
# 處理降雨機率
# ==========================================

for item in pop_data:

    end_time = item["EndTime"]

    forecast_date = end_time[:10]

    value = item["ElementValue"][0]["ProbabilityOfPrecipitation"]

    # CWA 沒有資料時為 "-"
    if value == "-":
        continue

    value = int(value)

    if forecast_date not in daily_data:

        daily_data[forecast_date] = {
            "max_temp": None,
            "min_temp": None,
            "weather": None,
            "weather_code": None,
            "pop": None
        }

    current_pop = daily_data[forecast_date]["pop"]

    # 同一天如果有多個時段，取較高的降雨機率
    if current_pop is None or value > current_pop:

        daily_data[forecast_date]["pop"] = value
        

# ==========================================
# 處理天氣現象
# ==========================================

for item in weather_data:

    start_time = item["StartTime"]
    end_time = item["EndTime"]

    forecast_date = end_time[:10]

    weather = item["ElementValue"][0]["Weather"]
    weather_code = item["ElementValue"][0]["WeatherCode"]

    # 解析開始時間
    start_datetime = datetime.fromisoformat(start_time)

    if forecast_date not in daily_data:

        daily_data[forecast_date] = {
            "max_temp": None,
            "min_temp": None,
            "weather": None,
            "weather_code": None,
            "pop": None
        }

    # 優先使用 06:00 開始的白天時段
    if start_datetime.hour == 6:

        daily_data[forecast_date]["weather"] = weather

        daily_data[forecast_date]["weather_code"] = weather_code


# ==========================================
# 排序
# ==========================================

sorted_dates = sorted(daily_data.keys())


# ==========================================
# 只取前 7 天
# ==========================================

sorted_dates = sorted_dates[:7]


# ==========================================
# 印出結果
# ==========================================

print()
print("=" * 60)
print("臺中市未來 7 天天氣")
print("=" * 60)


for forecast_date in sorted_dates:

    data = daily_data[forecast_date]

    pop_text = (
    f'{data["pop"]} %'
    if data["pop"] is not None
    else "無資料"
    )   

    print()
    print("日期:", forecast_date)
    print("最高溫:", data["max_temp"], "°C")
    print("最低溫:", data["min_temp"], "°C")
    print("天氣:", data["weather"])
    print("WeatherCode:", data["weather_code"])
    print("降雨機率:", pop_text)
