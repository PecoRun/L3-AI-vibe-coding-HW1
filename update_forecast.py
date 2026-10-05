"""
手動更新縣市 / 鄉鎮天氣預報。

網站上的「更新資料」按鈕只更新即時觀測（O-A0003-001），
預報資料不會跟著更新，需要時在終端機執行這個腳本：

    python update_forecast.py                    更新本機 SQLite
    python update_forecast.py --neon             更新 Neon（正式站資料庫）
    python update_forecast.py --skip-township    略過鄉鎮預報（比較快）

會更新的資料：
    F-C0032-001   縣市 3 天預報
    F-D0047-091   縣市 7 天預報（全台天氣概覽）
    F-D0047-093   鄉鎮預報（22 個縣市各呼叫一次，最花時間）

更新完成後，會順便清掉資料庫裡已過期（早於臺灣今天）的鄉鎮預報。

--neon 需要 .env 設定 DATABASE_URL。
"""

import argparse
import os
import sys


def parse_args(argv):

    parser = argparse.ArgumentParser(
        description="手動更新縣市 / 鄉鎮天氣預報"
    )

    parser.add_argument(
        "--neon",
        action="store_true",
        help="寫入 Neon PostgreSQL（預設寫入本機 SQLite）"
    )

    parser.add_argument(
        "--skip-township",
        action="store_true",
        help="略過鄉鎮預報（需要呼叫 22 次 API，比較慢）"
    )

    return parser.parse_args(argv)


def describe_error(error):
    """
    requests 的錯誤訊息會帶完整網址（含 API Key），
    只顯示錯誤類型與 HTTP 狀態碼。
    """

    response = getattr(error, "response", None)

    if response is not None:
        return (
            f"{type(error).__name__} "
            f"(HTTP {response.status_code})"
        )

    return type(error).__name__


def main(argv=None):

    args = parse_args(argv)

    # db.py 在載入時就會讀取 DATABASE_BACKEND，
    # 所以必須在 import database / services 之前設定
    if args.neon:
        os.environ["DATABASE_BACKEND"] = "postgres"

    from database.db import DATABASE_BACKEND
    from database.init_db import init_database
    from services.cwa_api import (
        CITY_LOCATION_IDS,
        fetch_township_weather_data,
        fetch_weather_data,
        fetch_weekly_weather_data
    )
    from services.weather_service import (
        delete_expired_township_forecasts,
        save_township_data,
        save_township_weather,
        save_weather_data,
        save_weekly_weather_data
    )

    is_postgres = DATABASE_BACKEND == "postgres"

    if is_postgres and not os.getenv("DATABASE_URL"):
        print("找不到 DATABASE_URL，請確認 .env 設定。")
        return 1

    print(
        "寫入資料庫："
        + ("Neon PostgreSQL" if is_postgres else "本機 SQLite")
    )

    # SQLite 確保資料表存在；Neon 的資料表由 init_neon_db.py 建立
    if not is_postgres:
        init_database()

    failures = []

    # ------------------------------------------
    # 縣市 3 天預報
    # ------------------------------------------

    print("\n[1/3] 縣市 3 天預報 F-C0032-001")

    try:
        save_weather_data(fetch_weather_data())
    except Exception as error:
        print(f"  失敗：{describe_error(error)}")
        failures.append("縣市 3 天預報")

    # ------------------------------------------
    # 縣市 7 天預報
    # ------------------------------------------

    print("\n[2/3] 縣市 7 天預報 F-D0047-091")

    try:
        save_weekly_weather_data(fetch_weekly_weather_data())
        print("  完成")
    except Exception as error:
        print(f"  失敗：{describe_error(error)}")
        failures.append("縣市 7 天預報")

    # ------------------------------------------
    # 鄉鎮預報（每個縣市呼叫一次）
    # ------------------------------------------

    if args.skip_township:

        print("\n[3/3] 鄉鎮預報：已略過")

    else:

        total = len(CITY_LOCATION_IDS)

        print(f"\n[3/3] 鄉鎮預報 F-D0047-093（{total} 個縣市）")

        failed_cities = []

        for index, (city_name, location_id) in enumerate(
            CITY_LOCATION_IDS.items(),
            start=1
        ):

            print(f"  ({index}/{total}) {city_name}")

            try:

                data = fetch_township_weather_data(location_id)

                # 先確保鄉鎮存在，再寫入預報
                save_township_data(data, city_name)
                save_township_weather(data)

            except Exception as error:

                print(f"    失敗：{describe_error(error)}")
                failed_cities.append(city_name)

        if failed_cities:
            failures.append(
                "鄉鎮預報（" + "、".join(failed_cities) + "）"
            )

    # ------------------------------------------
    # 清除過期的鄉鎮預報
    # ------------------------------------------

    print("\n清除過期的鄉鎮預報")

    try:

        deleted_count = delete_expired_township_forecasts()

        print(f"  已刪除 {deleted_count} 筆")

    except Exception as error:

        print(f"  失敗：{describe_error(error)}")
        failures.append("清除過期鄉鎮預報")

    # ------------------------------------------
    # 結果
    # ------------------------------------------

    print()

    if failures:

        print("以下項目更新失敗：")

        for item in failures:
            print(f"  - {item}")

        return 1

    print("預報資料更新完成。")

    return 0


if __name__ == "__main__":

    sys.exit(main())
