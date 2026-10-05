from datetime import datetime, timedelta, timezone

from database.db import get_db_connection, get_db_placeholder

from services.cwa_api import fetch_observation_data


def get_taiwan_today():
    """
    臺灣時間的今天，格式 YYYY-MM-DD。

    不用 datetime.now() / date.today()：Vercel 的伺服器是 UTC，
    臺灣時間 00:00～08:00 會拿到前一天。
    臺灣沒有日光節約時間，固定 +8 即可
    （也避免 Windows 沒有安裝時區資料庫時 ZoneInfo 找不到）。
    """

    taiwan_time = timezone(timedelta(hours=8))

    return datetime.now(taiwan_time).date().isoformat()


def save_township_data(data, city_name):
    """
    將 CWA 鄉鎮資料儲存到 SQLite
    """

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

    locations = data["records"]["Locations"][0]["Location"]

    for location in locations:

        township_name = location["LocationName"]
        geocode = location["Geocode"]
        latitude = float(location["Latitude"])
        longitude = float(location["Longitude"])

        cursor.execute(f"""
            INSERT INTO townships (
                city_name,
                township_name,
                geocode,
                latitude,
                longitude
            )
            VALUES (
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder}
            )

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

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

    try:
        locations = data["records"]["location"]

        for location in locations:

            location_name = location.get("locationName", "")
            city_name = location_name

            # -------------------------
            # 建立 / 取得地區
            # -------------------------
            cursor.execute(f"""
                INSERT INTO locations
                (
                    location_name,
                    city_name
                )
                VALUES ({placeholder}, {placeholder})
                ON CONFLICT(location_name, city_name)
                DO NOTHING
            """, (
                location_name,
                city_name
            ))

            cursor.execute(
                f"""
                SELECT id
                FROM locations
                WHERE location_name = {placeholder}
                AND city_name = {placeholder}
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
            # 清除該縣市舊的預報資料
            # -------------------------
            cursor.execute(
                f"""
                DELETE FROM weather_forecast
                WHERE location_id = {placeholder}
                """,
                (location_id,)
            )

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
                    f"""
                    INSERT INTO weather_forecast (
                        location_id,
                        start_time,
                        end_time,
                        min_temp,
                        max_temp,
                        pop,
                        weather,
                        comfort,
                        updated_at
                    )
                    VALUES (
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder},
                        {placeholder}
                    )
                    """,
                    (
                        location_id,
                        start_time,
                        end_time,
                        int(min_temp)
                        if min_temp.isdigit()
                        else None,
                        int(max_temp)
                        if max_temp.isdigit()
                        else None,
                        int(pop_value)
                        if pop_value.isdigit()
                        else None,
                        weather,
                        comfort,
                        datetime.now().isoformat()
                    )
                )

        # -------------------------
        # 更新紀錄
        # -------------------------
        cursor.execute(
            f"""
            INSERT INTO update_log
            (
                source,
                status,
                message
            )
            VALUES (
                {placeholder},
                {placeholder},
                {placeholder}
            )
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
            f"""
            INSERT INTO update_log
            (
                source,
                status,
                message
            )
            VALUES (
                {placeholder},
                {placeholder},
                {placeholder}
            )
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
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

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
                f"""
                SELECT id
                FROM locations
                WHERE location_name = {placeholder}
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
                    "StartTime"
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
                    "StartTime"
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
                    "StartTime"
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
            # 每天以 StartTime 所屬日期作為天氣現象日期
            # --------------------------------------------------

            for item in weather_data:

                start_time = item[
                    "StartTime"
                ]

                forecast_date = start_time[:10]

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

                if forecast_date not in daily_data:

                    daily_data[forecast_date] = {
                        "max_temp": None,
                        "min_temp": None,
                        "weather": None,
                        "weather_code": None,
                        "pop": None
                    }

                # 每天第一筆天氣作為預設值
                if daily_data[
                    forecast_date
                ]["weather"] is None:

                    daily_data[
                        forecast_date
                    ]["weather"] = weather

                    daily_data[
                        forecast_date
                    ]["weather_code"] = weather_code

                # 如果有 06:00 開始的白天天氣，
                # 優先使用白天天氣
                start_datetime = datetime.fromisoformat(
                    start_time
                )

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

            cursor.execute(
                f"""
                    DELETE FROM weather_daily_forecast
                    WHERE location_id = {placeholder}
                    """,
                (location_id,)
            )

            for forecast_date in sorted(
                daily_data.keys()
            )[:8]:

                item = daily_data[
                    forecast_date
                ]

                cursor.execute(
                    f"""
                        INSERT INTO weather_daily_forecast (
                            location_id,
                            forecast_date,
                            max_temp,
                            min_temp,
                            weather,
                            weather_code,
                            pop
                        )
                        VALUES (
                            {placeholder},
                            {placeholder},
                            {placeholder},
                            {placeholder},
                            {placeholder},
                            {placeholder},
                            {placeholder}
                        )
                        """,
                    (
                        location_id,
                        forecast_date,
                        item["max_temp"],
                        item["min_temp"],
                        item["weather"],
                        item["weather_code"],
                        item["pop"]
                    )
                )

            conn.commit()

    except Exception:

        conn.rollback()
        raise

    finally:

        conn.close()


def refresh_weather_data():
    """
    更新即時天氣觀測資料。

    Refresh 按鈕只更新 CWA O-A0003-001，
    不重新抓取預報資料，以降低 API 請求次數與等待時間。
    """

    # 更新 O-A0003-001 即時觀測資料
    observation_data = fetch_observation_data()
    save_observation_data(observation_data)

    return {
        "success": True,
        "message": "即時天氣資料更新成功",
        "source": "CWA O-A0003-001",
        "station_count": len(
            observation_data
            .get("records", {})
            .get("Station", [])
        )
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

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

    # 解析 CWA 資料
    weather_data = parse_township_weather(data)

    saved_count = 0

    for item in weather_data:

        township_name = item["township_name"]

        # 找到對應的 township_id
        city_name = data["records"]["Locations"][0]["LocationsName"]

        cursor.execute(
            f"""
            SELECT id
            FROM townships
            WHERE city_name = {placeholder}
            AND township_name = {placeholder}
            """,
            (
                city_name,
                township_name
            )
        )

        township = cursor.fetchone()

        if township is None:
            print(
                f"找不到鄉鎮：{township_name}"
            )
            continue

        township_id = township["id"]

        # 儲存天氣資料
        cursor.execute(
            f"""
            INSERT INTO township_weather_forecast (
                township_id,
                forecast_date,
                max_temp,
                min_temp,
                weather,
                weather_code,
                pop
            )
            VALUES (
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder},
                {placeholder}
            )

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

def delete_expired_township_forecasts():
    """
    刪除已過期（早於臺灣今天）的鄉鎮預報。

    save_township_weather 是「有就更新、沒有就新增」，
    不會刪除舊日期，資料表會越來越大。
    回傳刪除的筆數。
    """

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

    try:

        cursor.execute(
            f"""
            DELETE FROM township_weather_forecast
            WHERE forecast_date < {placeholder}
            """,
            (get_taiwan_today(),)
        )

        deleted_count = cursor.rowcount

        conn.commit()

        return deleted_count

    except Exception:

        conn.rollback()
        raise

    finally:

        conn.close()


def parse_observation_data(data):
    """
    解析 CWA O-A0003-001 即時觀測資料。

    每個測站只保留最新一筆資料。
    使用 WGS84 座標。
    """

    stations = data.get("records", {}).get("Station", [])

    results = []

    for station in stations:
        station_name = station.get("StationName")
        station_id = station.get("StationId")

        obs_time = (
            station.get("ObsTime", {})
            .get("DateTime")
        )

        # -----------------------------
        # GeoInfo
        # -----------------------------
        geo_info = station.get("GeoInfo", {})

        latitude = None
        longitude = None

        # 優先使用 WGS84
        for coordinate in geo_info.get("Coordinates", []):
            if coordinate.get("CoordinateName") == "WGS84":
                try:
                    latitude = float(
                        coordinate.get("StationLatitude")
                    )
                    longitude = float(
                        coordinate.get("StationLongitude")
                    )
                except (TypeError, ValueError):
                    latitude = None
                    longitude = None

                break

        # 如果沒有 WGS84，退回第一組座標
        if latitude is None or longitude is None:
            coordinates = geo_info.get("Coordinates", [])

            if coordinates:
                try:
                    latitude = float(
                        coordinates[0].get("StationLatitude")
                    )
                    longitude = float(
                        coordinates[0].get("StationLongitude")
                    )
                except (TypeError, ValueError):
                    latitude = None
                    longitude = None

        try:
            altitude = float(
                geo_info.get("StationAltitude")
            )
        except (TypeError, ValueError):
            altitude = None

        city_name = geo_info.get("CountyName")
        township_name = geo_info.get("TownName")
        city_code = geo_info.get("CountyCode")
        township_code = geo_info.get("TownCode")

        # -----------------------------
        # WeatherElement
        # -----------------------------
        weather_element = station.get(
            "WeatherElement",
            {}
        )

        weather = weather_element.get("Weather")

        # 降雨量
        precipitation = None

        now_data = weather_element.get("Now", {})

        try:
            precipitation = float(
                now_data.get("Precipitation")
            )
        except (TypeError, ValueError):
            precipitation = None

        # 風向
        try:
            wind_direction = float(
                weather_element.get("WindDirection")
            )
        except (TypeError, ValueError):
            wind_direction = None

        # 風速
        try:
            wind_speed = float(
                weather_element.get("WindSpeed")
            )
        except (TypeError, ValueError):
            wind_speed = None

        # 氣溫
        try:
            air_temperature = float(
                weather_element.get("AirTemperature")
            )
        except (TypeError, ValueError):
            air_temperature = None

        # 相對濕度
        try:
            relative_humidity = float(
                weather_element.get("RelativeHumidity")
            )
        except (TypeError, ValueError):
            relative_humidity = None

        # 氣壓
        try:
            air_pressure = float(
                weather_element.get("AirPressure")
            )
        except (TypeError, ValueError):
            air_pressure = None

        # UV
        try:
            uv_index = float(
                weather_element.get("UVIndex")
            )
        except (TypeError, ValueError):
            uv_index = None

        # -----------------------------
        # 最大陣風
        # -----------------------------
        peak_gust_speed = None

        gust_info = weather_element.get(
            "GustInfo",
            {}
        )

        try:
            peak_gust_speed = float(
                gust_info.get("PeakGustSpeed")
            )
        except (TypeError, ValueError):
            peak_gust_speed = None

        # -----------------------------
        # 今日最高 / 最低溫
        # -----------------------------
        daily_high_temperature = None
        daily_low_temperature = None

        daily_extreme = weather_element.get(
            "DailyExtreme",
            {}
        )

        daily_high = (
            daily_extreme
            .get("DailyHigh", {})
            .get("TemperatureInfo", {})
        )

        daily_low = (
            daily_extreme
            .get("DailyLow", {})
            .get("TemperatureInfo", {})
        )

        try:
            daily_high_temperature = float(
                daily_high.get("AirTemperature")
            )
        except (TypeError, ValueError):
            daily_high_temperature = None

        try:
            daily_low_temperature = float(
                daily_low.get("AirTemperature")
            )
        except (TypeError, ValueError):
            daily_low_temperature = None

        results.append({
            "station_id": station_id,
            "station_name": station_name,
            "observation_time": obs_time,

            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,

            "city_name": city_name,
            "township_name": township_name,
            "city_code": city_code,
            "township_code": township_code,

            "weather": weather,
            "precipitation": precipitation,
            "wind_direction": wind_direction,
            "wind_speed": wind_speed,
            "air_temperature": air_temperature,
            "relative_humidity": relative_humidity,
            "air_pressure": air_pressure,
            "uv_index": uv_index,
            "peak_gust_speed": peak_gust_speed,

            "daily_high_temperature": daily_high_temperature,
            "daily_low_temperature": daily_low_temperature
        })

    return results


def save_observation_data(data):
    """
    將 O-A0003-001 即時觀測資料儲存至 SQLite。
    每個測站只保留最新資料。
    """

    observation_data = parse_observation_data(data)

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = get_db_placeholder()

    try:
        for item in observation_data:

            cursor.execute(
                f"""
                INSERT INTO weather_observation (
                    station_id,
                    station_name,
                    observation_time,
                    latitude,
                    longitude,
                    altitude,
                    city_name,
                    township_name,
                    city_code,
                    township_code,
                    weather,
                    precipitation,
                    wind_direction,
                    wind_speed,
                    air_temperature,
                    relative_humidity,
                    air_pressure,
                    uv_index,
                    peak_gust_speed,
                    daily_high_temperature,
                    daily_low_temperature,
                    updated_at
                )
                VALUES (
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    {placeholder},
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT(station_id)
                DO UPDATE SET
                    station_name = excluded.station_name,
                    observation_time = excluded.observation_time,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    altitude = excluded.altitude,
                    city_name = excluded.city_name,
                    township_name = excluded.township_name,
                    city_code = excluded.city_code,
                    township_code = excluded.township_code,
                    weather = excluded.weather,
                    precipitation = excluded.precipitation,
                    wind_direction = excluded.wind_direction,
                    wind_speed = excluded.wind_speed,
                    air_temperature = excluded.air_temperature,
                    relative_humidity = excluded.relative_humidity,
                    air_pressure = excluded.air_pressure,
                    uv_index = excluded.uv_index,
                    peak_gust_speed = excluded.peak_gust_speed,
                    daily_high_temperature = excluded.daily_high_temperature,
                    daily_low_temperature = excluded.daily_low_temperature,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    item["station_id"],
                    item["station_name"],
                    item["observation_time"],
                    item["latitude"],
                    item["longitude"],
                    item["altitude"],
                    item["city_name"],
                    item["township_name"],
                    item["city_code"],
                    item["township_code"],
                    item["weather"],
                    item["precipitation"],
                    item["wind_direction"],
                    item["wind_speed"],
                    item["air_temperature"],
                    item["relative_humidity"],
                    item["air_pressure"],
                    item["uv_index"],
                    item["peak_gust_speed"],
                    item["daily_high_temperature"],
                    item["daily_low_temperature"]
                )
            )

        conn.commit()

        print(
            f"O-A0003-001 測站資料儲存成功："
            f"{len(observation_data)} 筆"
        )

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()