import sqlite3
from datetime import datetime

from database.init_db import DATABASE_PATH
from services.cwa_api import (
    fetch_weather_data,
    fetch_weekly_weather_data,
    fetch_township_weather_data,
    CITY_LOCATION_IDS
)


def get_connection():
    """取得 SQLite 連線"""

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    return conn


def save_township_data(data, city_name):
    """
    將 CWA 鄉鎮資料儲存到 SQLite
    """

    conn = get_connection()
    cursor = conn.cursor()

    locations = data["records"]["Locations"][0]["Location"]

    for location in locations:

        township_name = location["LocationName"]
        geocode = location["Geocode"]
        latitude = float(location["Latitude"])
        longitude = float(location["Longitude"])

        cursor.execute("""
            INSERT INTO townships (
                city_name,
                township_name,
                geocode,
                latitude,
                longitude
            )
            VALUES (?, ?, ?, ?, ?)

            ON CONFLICT(city_name, township_name)
            DO UPDATE SET
                geocode = excluded.geocode,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                updated_at = CURRENT_TIMESTAMP
        """, (
            city_name,
            township_name,
            geocode,
            latitude,
            longitude
        ))

    conn.commit()
    conn.close()

    print(
        f"{city_name} 鄉鎮資料儲存成功，"
        f"共 {len(locations)} 筆"
    )


def save_weather_data(data):
    """
    將 CWA 天氣資料儲存到 SQLite。
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        locations = data["records"]["location"]

        for location in locations:

            location_name = location.get("locationName", "")
            city_name = location_name

            # -------------------------
            # 建立 / 取得地區
            # -------------------------
            cursor.execute(
                """
                INSERT OR IGNORE INTO locations
                (
                    location_name,
                    city_name
                )
                VALUES (?, ?)
                """,
                (
                    location_name,
                    city_name
                )
            )

            cursor.execute(
                """
                SELECT id
                FROM locations
                WHERE location_name = ?
                AND city_name = ?
                """,
                (
                    location_name,
                    city_name
                )
            )

            location_row = cursor.fetchone()

            if not location_row:
                continue

            location_id = location_row["id"]

            # -------------------------
            # 天氣資料
            # -------------------------
            weather_elements = {}

            for element in location.get("weatherElement", []):

                element_name = element.get("elementName")

                if element_name:
                    weather_elements[element_name] = element.get(
                        "time",
                        []
                    )

            wx_data = weather_elements.get("Wx", [])
            pop_data = weather_elements.get("PoP", [])
            min_t_data = weather_elements.get("MinT", [])
            max_t_data = weather_elements.get("MaxT", [])
            ci_data = weather_elements.get("CI", [])

            # -------------------------
            # 三個預報時段
            # -------------------------
            for index in range(
                min(
                    len(wx_data),
                    len(pop_data),
                    len(min_t_data),
                    len(max_t_data),
                    len(ci_data)
                )
            ):

                wx = wx_data[index]
                pop = pop_data[index]
                min_t = min_t_data[index]
                max_t = max_t_data[index]
                ci = ci_data[index]

                start_time = wx.get("startTime", "")
                end_time = wx.get("endTime", "")

                weather = wx.get("parameter", {}).get(
                    "parameterName",
                    ""
                )

                pop_value = pop.get(
                    "parameter", {}
                ).get(
                    "parameterName",
                    ""
                )

                min_temp = min_t.get(
                    "parameter", {}
                ).get(
                    "parameterName",
                    ""
                )

                max_temp = max_t.get(
                    "parameter", {}
                ).get(
                    "parameterName",
                    ""
                )

                comfort = ci.get(
                    "parameter", {}
                ).get(
                    "parameterName",
                    ""
                )

                # -------------------------
                # 儲存資料
                # -------------------------
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO weather_forecast
                    (
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        location_id,
                        start_time,
                        end_time,
                        weather,
                        int(pop_value)
                        if pop_value.isdigit()
                        else None,
                        int(min_temp)
                        if min_temp.isdigit()
                        else None,
                        int(max_temp)
                        if max_temp.isdigit()
                        else None,
                        comfort,
                        datetime.now().isoformat()
                    )
                )

        # -------------------------
        # 更新紀錄
        # -------------------------
        cursor.execute(
            """
            INSERT INTO update_log
            (
                source,
                status,
                message
            )
            VALUES (?, ?, ?)
            """,
            (
                "CWA F-C0032-001",
                "success",
                "天氣資料更新成功"
            )
        )

        conn.commit()

    except Exception as error:

        conn.rollback()

        cursor.execute(
            """
            INSERT INTO update_log
            (
                source,
                status,
                message
            )
            VALUES (?, ?, ?)
            """,
            (
                "CWA F-C0032-001",
                "error",
                str(error)
            )
        )

        conn.commit()

        raise

    finally:
        conn.close()


def save_weekly_weather_data(data):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        locations = data["records"]["Locations"][0]["Location"]

        for location in locations:

            location_name = location.get("LocationName", "")

            if not location_name:
                continue

            # --------------------------------------------------
            # 找出對應的 locations.id
            # --------------------------------------------------

            cursor.execute(
                """
                SELECT id
                FROM locations
                WHERE location_name = ?
                """,
                (location_name,)
            )

            location_row = cursor.fetchone()

            if not location_row:
                print(
                    f"找不到地點：{location_name}"
                )
                continue

            location_id = location_row["id"]

            # --------------------------------------------------
            # 建立 WeatherElement 對照表
            # --------------------------------------------------

            weather_elements = {}

            for element in location.get(
                "WeatherElement",
                []
            ):

                element_name = element.get(
                    "ElementName"
                )

                if element_name:
                    weather_elements[
                        element_name
                    ] = element.get(
                        "Time",
                        []
                    )

            max_temp_data = weather_elements.get(
                "最高溫度",
                []
            )

            min_temp_data = weather_elements.get(
                "最低溫度",
                []
            )

            pop_data = weather_elements.get(
                "12小時降雨機率",
                []
            )

            weather_data = weather_elements.get(
                "天氣現象",
                []
            )

            # --------------------------------------------------
            # 每日資料
            # --------------------------------------------------

            daily_data = {}

            # --------------------------------------------------
            # 最高溫
            # --------------------------------------------------

            for item in max_temp_data:

                forecast_date = item[
                    "EndTime"
                ][:10]

                value = item[
                    "ElementValue"
                ][0].get(
                    "MaxTemperature"
                )

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

                current_value = daily_data[
                    forecast_date
                ]["max_temp"]

                if (
                    current_value is None
                    or value > current_value
                ):
                    daily_data[
                        forecast_date
                    ]["max_temp"] = value

            # --------------------------------------------------
            # 最低溫
            # --------------------------------------------------

            for item in min_temp_data:

                forecast_date = item[
                    "EndTime"
                ][:10]

                value = item[
                    "ElementValue"
                ][0].get(
                    "MinTemperature"
                )

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

                current_value = daily_data[
                    forecast_date
                ]["min_temp"]

                if (
                    current_value is None
                    or value < current_value
                ):
                    daily_data[
                        forecast_date
                    ]["min_temp"] = value

            # --------------------------------------------------
            # 降雨機率
            # --------------------------------------------------

            for item in pop_data:

                forecast_date = item[
                    "EndTime"
                ][:10]

                value = item[
                    "ElementValue"
                ][0].get(
                    "ProbabilityOfPrecipitation"
                )

                # "-" 代表沒有資料
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

                current_value = daily_data[
                    forecast_date
                ]["pop"]

                if (
                    current_value is None
                    or value > current_value
                ):
                    daily_data[
                        forecast_date
                    ]["pop"] = value

            # --------------------------------------------------
            # 天氣現象
            # 取每天 06:00 開始的白天天氣
            # --------------------------------------------------

            for item in weather_data:

                start_time = item[
                    "StartTime"
                ]

                forecast_date = item[
                    "EndTime"
                ][:10]

                weather = item[
                    "ElementValue"
                ][0].get(
                    "Weather"
                )

                weather_code = item[
                    "ElementValue"
                ][0].get(
                    "WeatherCode"
                )

                start_datetime = datetime.fromisoformat(
                    start_time
                )

                if forecast_date not in daily_data:

                    daily_data[forecast_date] = {
                        "max_temp": None,
                        "min_temp": None,
                        "weather": None,
                        "weather_code": None,
                        "pop": None
                    }

                if start_datetime.hour == 6:

                    daily_data[
                        forecast_date
                    ]["weather"] = weather

                    daily_data[
                        forecast_date
                    ]["weather_code"] = weather_code

            # --------------------------------------------------
            # 寫入資料庫
            # --------------------------------------------------

            for forecast_date in sorted(
                daily_data.keys()
            )[:7]:

                item = daily_data[
                    forecast_date
                ]

                cursor.execute(
                    """
                    INSERT OR REPLACE INTO
                    weather_daily_forecast
                    (
                        location_id,
                        forecast_date,
                        max_temp,
                        min_temp,
                        weather,
                        weather_code,
                        pop,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        location_id,
                        forecast_date,
                        item["max_temp"],
                        item["min_temp"],
                        item["weather"],
                        item["weather_code"],
                        item["pop"],
                        datetime.now().isoformat()
                    )
                )

        conn.commit()

    except Exception:

        conn.rollback()
        raise

    finally:

        conn.close()


def refresh_weather_data():

    # 1. 更新 36 小時縣市天氣
    data = fetch_weather_data()
    save_weather_data(data)

    # 2. 更新 7 天縣市預報
    weekly_data = fetch_weekly_weather_data()
    save_weekly_weather_data(weekly_data)

    # 3. 更新 22 縣市鄉鎮資料
    for city_name, location_id in CITY_LOCATION_IDS.items():

        print(
            f"開始更新 {city_name} 鄉鎮資料..."
        )

        township_data = (
            fetch_township_weather_data(
                location_id
            )
        )

        # 儲存鄉鎮基本資料
        save_township_data(
            township_data,
            city_name
        )

        # 儲存鄉鎮天氣
        save_township_weather(
            township_data
        )

    return {
        "success": True,
        "message": "天氣資料更新成功"
    }


def parse_township_weather(data):
    """
    解析 CWA F-D0047-093 鄉鎮天氣資料

    回傳：
    [
        {
            "township_name": "中區",
            "forecast_date": "2026-09-28",
            "max_temp": 30,
            "min_temp": 28,
            "weather": "晴",
            "weather_code": "01",
            "pop": 0
        },
        ...
    ]
    """

    locations = (
        data["records"]
        ["Locations"][0]
        ["Location"]
    )

    results = []

    for location in locations:

        township_name = location["LocationName"]

        elements = {}

        for element in location["WeatherElement"]:

            elements[
                element["ElementName"]
            ] = element["Time"]

        # -------------------------
        # 1. 溫度
        # -------------------------

        daily_temperature = {}

        for item in elements.get("溫度", []):

            temperature = (
                item["ElementValue"][0]
                .get("Temperature")
            )

            if temperature in (None, "-"):
                continue

            temperature = int(temperature)

            date = datetime.fromisoformat(
                item["DataTime"]
            ).date().isoformat()

            if date not in daily_temperature:
                daily_temperature[date] = []

            daily_temperature[date].append(
                temperature
            )

        # -------------------------
        # 2. 天氣現象
        # -------------------------

        daily_weather = {}

        for item in elements.get("天氣現象", []):

            date = datetime.fromisoformat(
                item["StartTime"]
            ).date().isoformat()

            weather_info = (
                item["ElementValue"][0]
            )

            if date not in daily_weather:

                daily_weather[date] = {
                    "weather":
                        weather_info.get(
                            "Weather"
                        ),
                    "weather_code":
                        weather_info.get(
                            "WeatherCode"
                        )
                }

        # -------------------------
        # 3. 降雨機率
        # -------------------------

        daily_pop = {}

        for item in elements.get(
            "3小時降雨機率",
            []
        ):

            date = datetime.fromisoformat(
                item["StartTime"]
            ).date().isoformat()

            pop = (
                item["ElementValue"][0]
                .get(
                    "ProbabilityOfPrecipitation"
                )
            )

            if pop in (None, "-"):
                continue

            pop = int(pop)

            # 同一天取最高降雨機率
            if (
                date not in daily_pop
                or pop > daily_pop[date]
            ):

                daily_pop[date] = pop

        # -------------------------
        # 4. 整合每日資料
        # -------------------------

        dates = set()

        dates.update(
            daily_temperature.keys()
        )

        dates.update(
            daily_weather.keys()
        )

        dates.update(
            daily_pop.keys()
        )

        for date in sorted(dates):

            temperatures = (
                daily_temperature.get(
                    date,
                    []
                )
            )

            weather_info = (
                daily_weather.get(
                    date,
                    {}
                )
            )

            result = {
                "township_name":
                    township_name,

                "forecast_date":
                    date,

                "max_temp":
                    max(temperatures)
                    if temperatures
                    else None,

                "min_temp":
                    min(temperatures)
                    if temperatures
                    else None,

                "weather":
                    weather_info.get(
                        "weather"
                    ),

                "weather_code":
                    weather_info.get(
                        "weather_code"
                    ),

                "pop":
                    daily_pop.get(
                        date
                    )
            }

            results.append(result)

    return results


def save_township_weather(data):
    """
    將解析後的鄉鎮天氣資料儲存到 SQLite
    """

    print(
        "目前儲存鄉鎮天氣資料：",
        data["records"]["Locations"][0].keys()
    )

    conn = get_connection()
    cursor = conn.cursor()

    # 解析 CWA 資料
    weather_data = parse_township_weather(data)

    saved_count = 0

    for item in weather_data:

        township_name = item["township_name"]

        # 找到對應的 township_id
        city_name = data["records"]["Locations"][0]["LocationsName"]

        cursor.execute("""
            SELECT id
            FROM townships
            WHERE city_name = ?
            AND township_name = ?
        """, (
            city_name,
            township_name
        ))

        township = cursor.fetchone()

        if township is None:
            print(
                f"找不到鄉鎮：{township_name}"
            )
            continue

        township_id = township["id"]

        # 儲存天氣資料
        cursor.execute("""
            INSERT INTO township_weather_forecast (
                township_id,
                forecast_date,
                max_temp,
                min_temp,
                weather,
                weather_code,
                pop
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)

            ON CONFLICT(
                township_id,
                forecast_date
            )
            DO UPDATE SET
                max_temp = excluded.max_temp,
                min_temp = excluded.min_temp,
                weather = excluded.weather,
                weather_code = excluded.weather_code,
                pop = excluded.pop,
                updated_at = CURRENT_TIMESTAMP
        """, (
            township_id,
            item["forecast_date"],
            item["max_temp"],
            item["min_temp"],
            item["weather"],
            item["weather_code"],
            item["pop"]
        ))

        saved_count += 1

    conn.commit()
    conn.close()

    print(
        f"鄉鎮天氣資料儲存成功："
        f"{saved_count} 筆"
    )
