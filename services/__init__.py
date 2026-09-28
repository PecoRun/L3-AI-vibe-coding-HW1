import os
import requests
from dotenv import load_dotenv


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