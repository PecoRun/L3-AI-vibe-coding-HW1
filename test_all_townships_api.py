from services.cwa_api import (
    CITY_LOCATION_IDS,
    fetch_township_weather_data
)


print("開始測試 22 縣市鄉鎮 API")
print("=" * 50)

success_count = 0
failed_count = 0

for city_name, location_id in CITY_LOCATION_IDS.items():

    try:

        data = fetch_township_weather_data(
            location_id
        )

        locations = (
            data["records"]
            ["Locations"][0]
            ["Location"]
        )

        print(
            f"✅ {city_name}："
            f"{len(locations)} 個鄉鎮"
        )

        success_count += 1

    except Exception as error:

        print(
            f"❌ {city_name}："
            f"{error}"
        )

        failed_count += 1


print("=" * 50)

print(
    f"測試完成：成功 {success_count} 個，"
    f"失敗 {failed_count} 個"
)