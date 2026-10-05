
const map = L.map("map", {
    zoomControl: false
}).setView(
    [23.7, 120.9],
    8
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

let selectedTownshipMarker = null;
let selectedMarker = null;

let currentMapMode = "temperature";

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

            selectedTownshipMarker =
                marker;

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

            setTimeout(() => {

                positionTownshipWeatherPopup(
                    marker
                );

            }, 100);

        }
    );
    townshipMarkers[
        township.township_name
    ] = marker;
}

function updateTownshipMarkers() {

    /*
     * ==========================================
     * 非「氣溫」模式
     *
     * 颱風 / 風速風向
     * 都不顯示縣市與鄉鎮天氣 Marker
     * ==========================================
     */

    if (currentMapMode !== "temperature") {

        Object.values(
            markers
        ).forEach(
            marker => {

                if (map.hasLayer(marker)) {

                    map.removeLayer(marker);

                }

            }
        );


        Object.values(
            townshipMarkers
        ).forEach(
            marker => {

                if (map.hasLayer(marker)) {

                    map.removeLayer(marker);

                }

            }
        );


        return;
    }


    /*
     * ==========================================
     * 氣溫模式
     * ==========================================
     */

    const zoom =
        map.getZoom();


    const townshipZoomLevel = 12;


    /*
     * ==========================================
     * Zoom < 12
     *
     * 顯示縣市 Marker
     * 隱藏鄉鎮 Marker
     * ==========================================
     */

    if (zoom < townshipZoomLevel) {

        /*
         * 隱藏鄉鎮 Marker
         */

        Object.values(
            townshipMarkers
        ).forEach(
            marker => {

                if (map.hasLayer(marker)) {

                    map.removeLayer(marker);

                }

            }
        );


        /*
         * 顯示縣市 Marker
         */

        Object.values(
            markers
        ).forEach(
            marker => {

                if (!map.hasLayer(marker)) {

                    marker.addTo(map);

                }

            }
        );


        /*
         * Zoom out 時關閉鄉鎮 Float Panel
         */

        if (selectedTownshipMarker) {

            const townshipPopup =
                document.getElementById(
                    "township-weather-popup"
                );


            if (townshipPopup) {

                townshipPopup.remove();

            }


            selectedTownshipMarker =
                null;

        }


        return;
    }


    /*
     * ==========================================
     * Zoom >= 12
     *
     * 隱藏縣市 Marker
     * 顯示目前畫面範圍內的鄉鎮 Marker
     * ==========================================
     */

    Object.values(
        markers
    ).forEach(
        marker => {

            if (map.hasLayer(marker)) {

                map.removeLayer(marker);

            }

        }
    );


    const bounds =
        map.getBounds();


    /*
     * 顯示畫面內的鄉鎮 Marker
     */

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


    /*
     * ==========================================
     * 檢查目前選中的鄉鎮 Marker
     * ==========================================
     */

    if (selectedTownshipMarker) {

        const selectedLatLng =
            selectedTownshipMarker.getLatLng();


        /*
         * Marker 已離開畫面
         * → 關閉 Float Panel
         */

        if (
            !bounds.contains(
                selectedLatLng
            )
        ) {

            const townshipPopup =
                document.getElementById(
                    "township-weather-popup"
                );


            if (townshipPopup) {

                townshipPopup.remove();

            }


            selectedTownshipMarker =
                null;

        }

    }

}

map.on("zoomend", updateTownshipMarkers);

map.on("zoom", () => {

    updateTownshipWeatherPopup();

});

map.on("moveend", updateTownshipMarkers);

map.on("move", () => {

    updateTownshipWeatherPopup();

});

// ==========================================
// 定位鄉鎮天氣浮動面板
// ==========================================

function positionTownshipWeatherPopup(
    marker
) {

    const popup =
        document.getElementById(
            "township-weather-popup"
        );

    if (!popup) {
        return;
    }


    const mapElement =
        document.getElementById(
            "map"
        );

    if (!mapElement) {
        return;
    }


    const point =
        map.latLngToContainerPoint(
            marker.getLatLng()
        );


    const mapRect =
        mapElement.getBoundingClientRect();


    const popupWidth =
        popup.offsetWidth;


    const popupHeight =
        popup.offsetHeight;


    let left =
        point.x + 18;


    let top =
        point.y - popupHeight / 2;


    // --------------------------------------
    // 防止超出右側
    // --------------------------------------

    if (
        left + popupWidth >
        mapRect.width - 10
    ) {

        left =
            point.x -
            popupWidth -
            18;

    }


    // --------------------------------------
    // 防止超出上方
    // --------------------------------------

    if (top < 10) {

        top = 10;

    }


    // --------------------------------------
    // 防止超出下方
    // --------------------------------------

    if (
        top + popupHeight >
        mapRect.height - 10
    ) {

        top =
            mapRect.height -
            popupHeight -
            10;

    }


    popup.style.left =
        `${left}px`;

    popup.style.top =
        `${top}px`;

}

function updateTownshipWeatherPopup() {

    const popup =
        document.getElementById(
            "township-weather-popup"
        );

    if (!popup || !selectedTownshipMarker) {
        return;
    }


    // --------------------------------------
    // 如果 Zoom 太小
    // 鄉鎮 Marker 已經不顯示
    // → 關閉浮動卡片
    // --------------------------------------

    const townshipZoomLevel = 12;

    if (
        map.getZoom() < townshipZoomLevel
    ) {

        popup.remove();

        selectedTownshipMarker = null;

        return;
    }


    // --------------------------------------
    // 檢查 Marker 是否還在目前地圖範圍
    // --------------------------------------

    const bounds =
        map.getBounds();

    const markerLatLng =
        selectedTownshipMarker.getLatLng();


    if (
        !bounds.contains(markerLatLng)
    ) {

        // Marker 已經離開目前畫面
        popup.remove();

        selectedTownshipMarker = null;

        return;
    }


    // --------------------------------------
    // Marker 還在畫面
    // → 更新 Popup 位置
    // --------------------------------------

    positionTownshipWeatherPopup(
        selectedTownshipMarker
    );
}

// ==========================================
// 地圖圖層模式
// ==========================================

function clearWeatherMarkers() {

    Object.values(markers).forEach(marker => {

        if (map.hasLayer(marker)) {

            map.removeLayer(marker);

        }

    });


    Object.values(townshipMarkers).forEach(marker => {

        if (map.hasLayer(marker)) {

            map.removeLayer(marker);

        }

    });
}


// ==========================================
// 移除地圖模式提示
// ==========================================

function removeMapModeMessage() {

    const message =
        document.getElementById(
            "map-mode-message"
        );

    if (message) {

        message.remove();

    }

}


// ==========================================
// 初始化氣象圖層按鈕
// ==========================================

function initializeMapLayerButtons() {

    const buttons =
        document.querySelectorAll(
            ".map-layer-btn"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const mode =
                    button.dataset.mapMode;


                if (!mode) {
                    return;
                }


                // 更新按鈕 active 狀態

                buttons.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );


                // 切換地圖模式

                setMapMode(mode);

            }
        );

    });

}


// ==========================================
// 初始化
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeMapLayerButtons();

    }
);