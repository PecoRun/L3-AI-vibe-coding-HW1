from flask import Flask, jsonify, render_template
import os
from database.init_db import init_database
from database.db import get_db_connection, get_db_placeholder
from services.weather_service import refresh_weather_data


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

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


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
    ORDER BY w.forecast_date
    """, (
        city_name,
        township_name,
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
