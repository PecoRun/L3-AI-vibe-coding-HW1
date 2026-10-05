from flask import Flask, jsonify, render_template
from database.init_db import init_database
from database.db import get_db_connection, get_db_placeholder
from services.weather_service import (
    get_taiwan_today,
    refresh_weather_data
)
from services.cwa_api import fetch_typhoon_data


app = Flask(__name__)


# 啟動時確認 Database 存在
if __name__ == "__main__":
    init_database()


@app.route("/")
def index():
    return render_template("index.html")


# ==========================================
# 更新天氣資料
# CWA Open Data → SQLite
# ==========================================
@app.route("/api/weather/refresh", methods=["POST"])
def refresh_weather():

    try:
        result = refresh_weather_data()

        return jsonify(result)

    except Exception as error:

        # requests 的錯誤訊息會帶完整網址（含 API Key），
        # 不回傳給瀏覽器，log 也只記錄錯誤類型
        app.logger.error(
            "更新天氣資料失敗：%s",
            type(error).__name__
        )

        return jsonify({
            "success": False,
            "message": "更新天氣資料失敗"
        }), 500


# ==========================================
# 颱風
# CWA W-C0034-005 → API（不寫入資料庫）
# ==========================================
@app.route("/api/typhoon", methods=["GET"])
def get_typhoon():

    try:
        typhoons = fetch_typhoon_data()

        return jsonify({
            "success": True,
            "count": len(typhoons),
            "data": typhoons
        })

    except Exception as error:

        # requests 的錯誤訊息會帶完整網址（含 API Key），
        # 不回傳給瀏覽器，log 也只記錄錯誤類型
        app.logger.error(
            "取得颱風資料失敗：%s",
            type(error).__name__
        )

        return jsonify({
            "success": False,
            "message": "取得颱風資料失敗"
        }), 502


@app.route("/api/weather/observation", methods=["GET"])
def get_weather_observation():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
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
        FROM weather_observation
        ORDER BY city_name, station_name
    """)

    rows = cursor.fetchall()
    conn.close()

    observation_data = [
        dict(row)
        for row in rows
    ]

    return jsonify({
        "success": True,
        "count": len(observation_data),
        "data": observation_data
    })

# ==========================================
# 取得天氣資料
# SQLite → API
# ==========================================


@app.route("/api/weather", methods=["GET"])
def get_weather():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            locations.location_name,
            weather_forecast.start_time,
            weather_forecast.end_time,
            weather_forecast.weather,
            weather_forecast.pop,
            weather_forecast.min_temp,
            weather_forecast.max_temp,
            weather_forecast.comfort,
            weather_forecast.updated_at
        FROM weather_forecast
        JOIN locations
            ON weather_forecast.location_id = locations.id
        ORDER BY
            locations.id,
            weather_forecast.start_time
    """)

    rows = cursor.fetchall()

    conn.close()

    weather_data = [
        dict(row)
        for row in rows
    ]

    return jsonify({
        "success": True,
        "count": len(weather_data),
        "data": weather_data
    })


@app.route("/api/locations", methods=["GET"])
def get_locations():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            id,
            location_name,
            city_name,
            latitude,
            longitude
        FROM locations
        ORDER BY id
    """)

    rows = cursor.fetchall()

    conn.close()

    locations = [
        dict(row)
        for row in rows
    ]

    return jsonify({
        "success": True,
        "count": len(locations),
        "data": locations
    })


@app.route("/api/townships", methods=["GET"])
def get_townships():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            city_name,
            township_name,
            geocode,
            latitude,
            longitude,
            updated_at
        FROM townships
        ORDER BY
            city_name,
            township_name
    """)

    rows = cursor.fetchall()

    conn.close()

    townships = [
        dict(row)
        for row in rows
    ]

    return jsonify({
        "success": True,
        "count": len(townships),
        "data": townships
    })


@app.route(
    "/api/townships/<city_name>/<township_name>/weather",
    methods=["GET"]
)
def get_township_weather(
    city_name,
    township_name
):

    from urllib.parse import unquote

    city_name = unquote(city_name)
    township_name = unquote(township_name)

    conn = get_db_connection()
    cursor = conn.cursor()

    placeholder = get_db_placeholder()

    cursor.execute(f"""
    SELECT
        t.township_name,
        t.city_name,
        w.forecast_date,
        w.max_temp,
        w.min_temp,
        w.weather,
        w.weather_code,
        w.pop,
        w.updated_at
    FROM township_weather_forecast w
    JOIN townships t
        ON w.township_id = t.id
    WHERE
        t.city_name = {placeholder}
        AND t.township_name = {placeholder}
        AND w.forecast_date >= {placeholder}
    ORDER BY w.forecast_date
    """, (
        city_name,
        township_name,
        # 只回傳今天（臺灣時間）以後的預報，
        # 不論資料庫裡有沒有清掉過期日期
        get_taiwan_today(),
    ))

    rows = cursor.fetchall()

    conn.close()

    weather_data = [
        dict(row)
        for row in rows
    ]

    if not weather_data:

        return jsonify({
            "success": False,
            "message": "找不到鄉鎮天氣資料"
        }), 404

    return jsonify({
        "success": True,
        "township_name": township_name,
        "count": len(weather_data),
        "data": weather_data
    })


@app.route("/api/weather/weekly", methods=["GET"])
def get_weekly_weather():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            locations.location_name,
            weather_daily_forecast.forecast_date,
            weather_daily_forecast.max_temp,
            weather_daily_forecast.min_temp,
            weather_daily_forecast.weather,
            weather_daily_forecast.weather_code,
            weather_daily_forecast.pop,
            weather_daily_forecast.updated_at
        FROM weather_daily_forecast
        JOIN locations
            ON weather_daily_forecast.location_id = locations.id
        ORDER BY
            locations.id,
            weather_daily_forecast.forecast_date
    """)

    rows = cursor.fetchall()

    conn.close()

    weekly_data = [
        dict(row)
        for row in rows
    ]

    return jsonify({
        "success": True,
        "count": len(weekly_data),
        "data": weekly_data
    })


if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )
