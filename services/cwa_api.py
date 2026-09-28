import os
import requests
from dotenv import load_dotenv

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

    response = requests.get(
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

    response = requests.get(
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

    response = requests.get(
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
