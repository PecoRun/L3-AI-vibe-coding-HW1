from services.cwa_api import fetch_weekly_weather_data


data = fetch_weekly_weather_data()

locations = data["records"]["Locations"][0]["Location"]

print("資料總數：", len(locations))

print("\n前 30 個鄉鎮：")

for index, location in enumerate(
    locations[:30],
    start=1
):

    print(
        index,
        "|",
        location.get("LocationName"),
        "|",
        location.get("Geocode"),
        "|",
        location.get("Latitude"),
        "|",
        location.get("Longitude")
    )