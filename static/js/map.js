
const map = L.map("map", {
    zoomControl: false
}).setView(
    [23.7, 120.9],
    7
);


// 將縮放控制項移到左下角
L.control.zoom({
    position: "bottomleft"
}).addTo(map);


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution:
            '&copy; OpenStreetMap contributors'
    }
).addTo(map);


const markers = {};
const townshipMarkers = {};

console.log(
    "Leaflet 地圖初始化成功"
);

loadTownshipMarkers();

async function loadTownshipMarkers() {

    try {

        const response =
            await fetch("/api/townships");

        const result =
            await response.json();

        if (!result.success) {
            throw new Error(
                "取得鄉鎮資料失敗"
            );
        }

        console.log(
            "鄉鎮資料載入成功：",
            result.count,
            "筆"
        );

        result.data.forEach(
            township => {

                createTownshipMarker(
                    township
                );

            }
        );

    } catch (error) {

        console.error(
            "載入鄉鎮資料失敗：",
            error
        );

    }
}

function createTownshipMarker(township) {

    const marker =
        L.marker([
            township.latitude,
            township.longitude
        ]);

    marker.bindTooltip(
        township.township_name,
        {
            direction: "top",
            offset: [0, -8]
        }
    );

    marker.on(
        "click",
        async function () {

            console.log(
                "點擊鄉鎮：",
                township.township_name
            );

            console.log(
                "所屬縣市：",
                township.city_name
            );


            // 更新左側「全台天氣概覽」
            const overviewSelect =
                document.getElementById(
                    "overview-location"
                );

            if (overviewSelect) {

                overviewSelect.value =
                    township.city_name;
            }


            updateOverview(
                township.city_name
            );


            // 更新右側鄉鎮天氣面板
            await loadTownshipWeather(
                township.city_name,
                township.township_name
            );

        }
    );
    townshipMarkers[
        township.township_name
    ] = marker;
}

function updateTownshipMarkers() {

    const zoom =
        map.getZoom();

    const townshipZoomLevel = 12;

    if (zoom < townshipZoomLevel) {

        // -------------------------
        // 縮小：顯示縣市 Marker
        // -------------------------

        Object.values(
            townshipMarkers
        ).forEach(
            marker => {

                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }

            }
        );

        Object.values(
            markers
        ).forEach(
            marker => {

                if (!map.hasLayer(marker)) {

                    marker.addTo(map);

                }

            }
        );

        return;
    }


    // -------------------------
    // 放大：顯示鄉鎮 Marker
    // -------------------------

    Object.values(
        markers
    ).forEach(
        marker => {

            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }

        }
    );


    // 取得目前地圖可視範圍
    const bounds =
        map.getBounds();


    Object.values(
        townshipMarkers
    ).forEach(
        marker => {

            const latLng =
                marker.getLatLng();

            if (
                bounds.contains(latLng)
            ) {

                if (!map.hasLayer(marker)) {

                    marker.addTo(map);

                }

            } else {

                if (map.hasLayer(marker)) {

                    map.removeLayer(marker);

                }

            }

        }
    );
}

map.on(
    "zoomend",
    updateTownshipMarkers
);

map.on(
    "moveend",
    updateTownshipMarkers
);