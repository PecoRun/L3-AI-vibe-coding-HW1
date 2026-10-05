import os
import ssl
from datetime import datetime, timedelta

import requests
from requests.adapters import HTTPAdapter
from dotenv import load_dotenv

# ==========================================
# CWA 連線
#
# opendata.cwa.gov.tw 的憑證缺少 Subject Key Identifier，
# Python 3.13 以上預設的嚴格檢查（VERIFY_X509_STRICT）
# 會因此拒絕連線（CERTIFICATE_VERIFY_FAILED）。
# 只針對 CWA 網域關閉這個嚴格旗標，
# 憑證與網域名稱仍然照常驗證。
# ==========================================


class CwaHttpAdapter(HTTPAdapter):

    def init_poolmanager(self, *args, **kwargs):

        context = ssl.create_default_context()

        context.verify_flags &= ~ssl.VERIFY_X509_STRICT

        kwargs["ssl_context"] = context

        super().init_poolmanager(*args, **kwargs)


cwa_session = requests.Session()

cwa_session.mount(
    "https://opendata.cwa.gov.tw",
    CwaHttpAdapter()
)

# ==========================================
# CWA 縣市 Location ID
# ==========================================

CITY_LOCATION_IDS = {
    "基隆市": "F-D0047-049",
    "臺北市": "F-D0047-061",
    "新北市": "F-D0047-069",
    "桃園市": "F-D0047-005",
    "新竹市": "F-D0047-053",
    "新竹縣": "F-D0047-009",
    "苗栗縣": "F-D0047-013",
    "臺中市": "F-D0047-073",
    "彰化縣": "F-D0047-017",
    "南投縣": "F-D0047-021",
    "雲林縣": "F-D0047-025",
    "嘉義市": "F-D0047-057",
    "嘉義縣": "F-D0047-029",
    "臺南市": "F-D0047-077",
    "高雄市": "F-D0047-065",
    "屏東縣": "F-D0047-033",
    "宜蘭縣": "F-D0047-001",
    "花蓮縣": "F-D0047-043",
    "臺東縣": "F-D0047-037",
    "澎湖縣": "F-D0047-045",
    "金門縣": "F-D0047-085",
    "連江縣": "F-D0047-081"
}

load_dotenv()


CWA_API_URL = (
    "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
    "F-C0032-001"
)


def fetch_observation_data():
    """
    從中央氣象署 CWA Open Data
    取得 O-A0003-001 即時觀測資料。
    """

    api_key = os.getenv("CWA_API_KEY")

    if not api_key:
        raise RuntimeError(
            "找不到 CWA_API_KEY，請確認 .env 是否設定。"
        )

    observation_api_url = (
        "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
        "O-A0003-001"
    )

    params = {
        "Authorization": api_key,
        "format": "json"
    }

    response = cwa_session.get(
        observation_api_url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if data.get("success") != "true":
        raise RuntimeError(
            f"CWA O-A0003-001 API 回傳失敗：{data}"
        )

    return data


def _to_float(value):
    """CWA 缺值會是 ""、"-" 等字串，一律轉成 None。"""

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_list(value):
    """CWA 的陣列欄位在只有一筆時可能是物件，統一成 list。"""

    if not value:
        return []

    if isinstance(value, list):
        return value

    return [value]


def _circle_radius_km(circle):

    if isinstance(circle, dict):
        return _to_float(circle.get("Radius"))

    return None


def _parse_typhoon(cyclone):
    """
    整理單一熱帶氣旋：過去路徑、目前位置、未來預報。
    座標無效的點會略過；完全沒有有效定位點則回傳 None。
    """

    analysis_fixes = _as_list(
        (cyclone.get("AnalysisData") or {}).get("Fix")
    )

    forecast_fixes = _as_list(
        (cyclone.get("ForecastData") or {}).get("Fix")
    )

    track = []
    latest_fix = None

    for fix in analysis_fixes:

        longitude = _to_float(fix.get("CoordinateLongitude"))
        latitude = _to_float(fix.get("CoordinateLatitude"))

        if longitude is None or latitude is None:
            continue

        track.append({
            "time": fix.get("DateTime"),
            "longitude": longitude,
            "latitude": latitude,
            "max_wind_speed": _to_float(fix.get("MaxWindSpeed")),
            "pressure": _to_float(fix.get("Pressure"))
        })

        latest_fix = fix

    if not track:
        return None

    # 目前位置 = 最後一個有效的過去定位點
    moving_text = None

    for item in _as_list(latest_fix.get("MovingPrediction")):

        if item.get("lang") == "zh-hant":
            moving_text = item.get("value")
            break

    latest = {
        **track[-1],
        "max_gust_speed": _to_float(latest_fix.get("MaxGustSpeed")),
        "moving_speed": _to_float(latest_fix.get("MovingSpeed")),
        "moving_direction": latest_fix.get("MovingDirection"),
        "moving_text": moving_text,
        # 七級風（15 m/s）、十級風（25 m/s）暴風半徑，單位公里
        "radius_7": _circle_radius_km(latest_fix.get("Circle15ms")),
        "radius_10": _circle_radius_km(latest_fix.get("Circle25ms"))
    }

    forecast = []

    for fix in forecast_fixes:

        longitude = _to_float(fix.get("CoordinateLongitude"))
        latitude = _to_float(fix.get("CoordinateLatitude"))

        if longitude is None or latitude is None:
            continue

        forecast_hour = _to_float(fix.get("ForecastHour"))

        forecast_time = None

        try:
            forecast_time = (
                datetime.fromisoformat(fix["InitialTime"])
                + timedelta(hours=forecast_hour)
            ).isoformat()
        except (KeyError, TypeError, ValueError):
            pass

        forecast.append({
            "time": forecast_time,
            "forecast_hour": forecast_hour,
            "longitude": longitude,
            "latitude": latitude,
            "max_wind_speed": _to_float(fix.get("MaxWindSpeed")),
            "pressure": _to_float(fix.get("Pressure")),
            # 70% 機率圈半徑，單位公里
            "radius_70": _to_float(
                fix.get("Radius70PercentProbability")
            )
        })

    return {
        "name_zh": cyclone.get("CwaTyphoonName") or None,
        "name_en": cyclone.get("TyphoonName") or None,
        "ty_no": cyclone.get("CwaTyNo") or None,
        "td_no": cyclone.get("CwaTdNo") or None,
        "latest": latest,
        "track": track,
        "forecast": forecast
    }


def fetch_typhoon_data():
    """
    從中央氣象署 CWA Open Data
    取得 W-C0034-005 熱帶氣旋（颱風）路徑與預報。

    回傳目前所有活躍的熱帶氣旋；沒有颱風時回傳空 list。
    """

    api_key = os.getenv("CWA_API_KEY")

    if not api_key:
        raise RuntimeError(
            "找不到 CWA_API_KEY，請確認 .env 是否設定。"
        )

    typhoon_api_url = (
        "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
        "W-C0034-005"
    )

    params = {
        "Authorization": api_key,
        "format": "JSON"
    }

    response = cwa_session.get(
        typhoon_api_url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if data.get("success") != "true":
        raise RuntimeError(
            f"CWA 颱風 API 回傳失敗：{data}"
        )

    records = data.get("records") or {}

    cyclones = records.get("TropicalCyclones")

    if isinstance(cyclones, dict):
        cyclones = cyclones.get("TropicalCyclone")

    typhoons = []

    for cyclone in _as_list(cyclones):

        typhoon = _parse_typhoon(cyclone)

        if typhoon:
            typhoons.append(typhoon)

    return typhoons


def fetch_weather_data():
    """
    從中央氣象署 CWA Open Data 取得天氣資料。
    """

    api_key = os.getenv("CWA_API_KEY")

    if not api_key:
        raise RuntimeError(
            "找不到 CWA_API_KEY，請確認 .env 是否設定。"
        )

    params = {
        "Authorization": api_key,
        "format": "json"
    }

    response = cwa_session.get(
        CWA_API_URL,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if data.get("success") != "true":
        raise RuntimeError(
            f"CWA API 回傳失敗：{data}"
        )

    return data


def fetch_weekly_weather_data():
    api_key = os.getenv("CWA_API_KEY")

    if not api_key:
        raise RuntimeError(
            "找不到 CWA_API_KEY，請確認 .env 是否設定。"
        )

    weekly_api_url = (
        "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
        "F-D0047-091"
    )

    params = {
        "Authorization": api_key,
        "format": "json"
    }

    response = cwa_session.get(
        weekly_api_url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if data.get("success") != "true":
        raise RuntimeError(
            f"CWA 7天預報 API 回傳失敗：{data}"
        )

    return data


def fetch_township_weather_data(location_id):
    api_key = os.getenv("CWA_API_KEY")

    if not api_key:
        raise RuntimeError(
            "找不到 CWA_API_KEY，請確認 .env 是否設定。"
        )

    township_api_url = (
        "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
        "F-D0047-093"
    )

    params = {
        "Authorization": api_key,
        "format": "json",
        "locationId": location_id
    }

    response = cwa_session.get(
        township_api_url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if data.get("success") != "true":
        raise RuntimeError(
            f"CWA 鄉鎮天氣 API 回傳失敗：{data}"
        )

    return data
