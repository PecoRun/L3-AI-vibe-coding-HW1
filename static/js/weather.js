
// ==========================================
// 全台天氣概覽
// ==========================================

let weeklyWeatherData = [];
let townshipWeatherData = [];

// ==========================================
// 載入 7 天預報資料
// ==========================================

async function loadWeeklyWeather() {

    try {

        const response = await fetch(
            "/api/weather/weekly"
        );

        const result = await response.json();

        if (!result.success) {
            throw new Error(
                "取得 7 天預報失敗"
            );
        }

        weeklyWeatherData = result.data;

        console.log(
            "7 天預報載入成功：",
            weeklyWeatherData
        );

        populateOverviewLocations();

    } catch (error) {

        console.error(
            "載入 7 天預報失敗：",
            error
        );

    }
}


// ==========================================
// 建立縣市下拉選單
// ==========================================

function populateOverviewLocations() {

    const select = document.getElementById(
        "overview-location"
    );

    if (!select) {
        return;
    }


    // 清除原本選項
    select.innerHTML = "";


    // 建立預設選項
    const defaultOption =
        document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent =
        "請選擇縣市";

    select.appendChild(
        defaultOption
    );


    // 取得不重複的縣市
    const locations = [
        ...new Set(
            weeklyWeatherData.map(
                item => item.location_name
            )
        )
    ];


    // 建立選項
    locations.forEach(
        locationName => {

            const option =
                document.createElement(
                    "option"
                );

            option.value = locationName;

            option.textContent =
                locationName;

            select.appendChild(
                option
            );

        }
    );


    console.log(
        "縣市選單建立完成：",
        locations
    );

}


// ==========================================
// 7 天溫度折線圖
// ==========================================

let weeklyTemperatureChart = null;


function renderWeeklyTemperatureChart(
    locationData
) {

    const canvas =
        document.getElementById(
            "weekly-temperature-chart"
        );

    if (!canvas) {
        return;
    }


    // 如果已經有舊圖表
    // 先銷毀
    if (weeklyTemperatureChart) {

        weeklyTemperatureChart.destroy();

        weeklyTemperatureChart = null;
    }


    // X 軸：日期
    const weekNames = [
        "日",
        "一",
        "二",
        "三",
        "四",
        "五",
        "六"
    ];

    const labels = locationData.map(
        (item, index) => {

            const [
                year,
                month,
                day
            ] =
                item.forecast_date
                    .split("-")
                    .map(Number);

            const date = new Date(
                year,
                month - 1,
                day
            );

            const week =
                weekNames[
                date.getDay()
                ];

            if (index === 0) {
                return `明天 ${month}/${day}`;
            }

            return `${month}/${day}（${week}）`;
        }
    );


    // 最高溫
    const maxTemps =
        locationData.map(
            item => item.max_temp
        );


    // 最低溫
    const minTemps =
        locationData.map(
            item => item.min_temp
        );


    weeklyTemperatureChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels: labels,

                    datasets: [

                        {
                            label: "最高溫",

                            data: maxTemps,

                            tension: 0.35,

                            borderWidth: 2,

                            pointRadius: 3,

                            pointHoverRadius: 5,

                            fill: false
                        },

                        {
                            label: "最低溫",

                            data: minTemps,

                            tension: 0.35,

                            borderWidth: 2,

                            pointRadius: 3,

                            pointHoverRadius: 5,

                            fill: false
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {

                        legend: {
                            display: true,

                            position: "top",

                            labels: {
                                boxWidth: 10,
                                boxHeight: 10,
                                usePointStyle: true
                            }
                        },

                        tooltip: {

                            callbacks: {

                                label: function (context) {

                                    return (
                                        context.dataset.label
                                        + ": "
                                        + context.parsed.y
                                        + "°C"
                                    );

                                }

                            }

                        }

                    },

                    scales: {

                        x: {

                            grid: {
                                display: false
                            },

                            ticks: {
                                font: {
                                    size: 10
                                }
                            }

                        },

                        y: {

                            grid: {
                                color:
                                    "rgba(0, 0, 0, 0.06)"
                            },

                            ticks: {

                                font: {
                                    size: 10
                                },

                                callback: function (value) {

                                    return value + "°";

                                }

                            }

                        }

                    }

                }

            }
        );
}


// ==========================================
// 顯示選定縣市的天氣摘要
// ==========================================

function updateOverview(locationName) {

    if (!locationName) {
        return;
    }


    // 找出該縣市的 7 天資料
    const locationData =
        weeklyWeatherData.filter(
            item =>
                item.location_name === locationName
        );


    if (locationData.length === 0) {

        console.warn(
            "找不到縣市資料：",
            locationName
        );

        return;
    }


    // 按日期排序
    locationData.sort(
        (a, b) =>
            a.forecast_date.localeCompare(
                b.forecast_date
            )
    );


    // 取第一天
    const firstDayData =
        locationData[0];


    // ------------------------------------------
    // 更新縣市名稱
    // ------------------------------------------

    const locationElement =
        document.getElementById(
            "overview-location-name"
        );

    locationElement.textContent =
        locationName;


    // ------------------------------------------
    // 更新天氣
    // ------------------------------------------

    const weatherElement =
        document.getElementById(
            "overview-weather"
        );

    weatherElement.textContent =
        firstDayData.weather || "無資料";

    const weatherIconElement =
        document.querySelector(
            ".overview-weather-icon"
        );

    if (weatherIconElement) {
        weatherIconElement.textContent =
            getOverviewWeatherIcon(
                firstDayData.weather_code
            );
    }


    // ------------------------------------------
    // 更新最高溫
    // ------------------------------------------

    const maxTempElement =
        document.getElementById(
            "overview-max-temp"
        );

    maxTempElement.textContent =
        firstDayData.max_temp !== null
            ? firstDayData.max_temp
            : "—";


    // ------------------------------------------
    // 更新最低溫
    // ------------------------------------------

    const minTempElement =
        document.getElementById(
            "overview-min-temp"
        );

    minTempElement.textContent =
        firstDayData.min_temp !== null
            ? firstDayData.min_temp
            : "—";

    const popElement =
        document.getElementById(
            "overview-pop"
        );

    if (popElement) {

        popElement.textContent =
            firstDayData.pop !== null
                ? firstDayData.pop
                : "—";

    }


    console.log(
        "目前選擇縣市：",
        locationName
    );

    console.log(
        "7 天資料：",
        locationData
    );

    renderWeeklyTemperatureChart(locationData);

    renderWeeklyForecastList(locationData);
}

function getOverviewWeatherIcon(weatherCode) {

    const code = parseInt(
        weatherCode,
        10
    );

    if (isNaN(code)) {
        return "🌡️";
    }

    if (code === 1) {
        return "☀️";
    }

    if (code === 2) {
        return "🌤️";
    }

    if (code >= 3 && code <= 4) {
        return "⛅";
    }

    if (code >= 5 && code <= 8) {
        return "☁️";
    }

    if (code >= 9 && code <= 12) {
        return "🌧️";
    }

    if (code >= 13 && code <= 15) {
        return "⛈️";
    }

    return "🌡️";
}

async function loadTownshipWeather(
    cityName,
    townshipName
) {

    try {

        console.log(
            "開始取得鄉鎮天氣：",
            cityName,
            townshipName
        );

        const response =
            await fetch(
                `/api/townships/${encodeURIComponent(
                    cityName
                )}/${encodeURIComponent(
                    townshipName
                )}/weather`
            );

        const result =
            await response.json();

        if (!result.success) {
            throw new Error(
                result.message ||
                "取得鄉鎮天氣失敗"
            );
        }

        townshipWeatherData =
            result.data;

        console.log(
            "鄉鎮天氣載入成功：",
            townshipWeatherData
        );

        showTownshipWeatherPanel(
            townshipName,
            townshipWeatherData
        );

        return townshipWeatherData;

    } catch (error) {

        console.error(
            "載入鄉鎮天氣失敗：",
            error
        );

        return [];

    }
}

// ==========================================
// 顯示鄉鎮天氣資訊
// ==========================================

function showTownshipWeatherPanel(
    townshipName,
    weatherData
) {

    const panel =
        document.getElementById(
            "weather-panel"
        );

    if (!panel) {
        return;
    }


    // --------------------------------------
    // 防呆
    // --------------------------------------

    if (
        !Array.isArray(weatherData) ||
        weatherData.length === 0
    ) {

        panel.innerHTML = `

            <div class="panel-empty">

                <div class="panel-icon">
                    🌥️
                </div>

                <h2>
                    ${townshipName}
                </h2>

                <p>
                    目前沒有可用的天氣資料。
                </p>

            </div>

        `;

        return;
    }


    // --------------------------------------
    // 依日期排序
    // --------------------------------------

    const sortedWeatherData =
        [...weatherData].sort(
            (a, b) =>
                a.forecast_date.localeCompare(
                    b.forecast_date
                )
        );


    // --------------------------------------
    // 第一筆作為目前天氣
    // --------------------------------------

    const current =
        sortedWeatherData[0];

    const cityName =
        current.city_name || "—";


    const weather =
        current.weather || "未知";


    const weatherIcon =
        getWeatherIcon(weather);


    const maxTemp =
        current.max_temp !== null &&
            current.max_temp !== undefined
            ? `${current.max_temp}°`
            : "--";


    const minTemp =
        current.min_temp !== null &&
            current.min_temp !== undefined
            ? `${current.min_temp}°`
            : "--";


    const pop =
        current.pop !== null &&
            current.pop !== undefined
            ? `${current.pop}%`
            : "--";


    // --------------------------------------
    // 建立未來預報
    // --------------------------------------

    let forecastHTML = "";


    sortedWeatherData.forEach(
        (item, index) => {

            const [
                year,
                month,
                day
            ] =
                item.forecast_date
                    .split("-")
                    .map(Number);


            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );


            const weekNames = [
                "日",
                "一",
                "二",
                "三",
                "四",
                "五",
                "六"
            ];


            const week =
                weekNames[
                date.getDay()
                ];


            const dateText =
                index === 0
                    ? `明天 ${month}/${day}`
                    : `${month}/${day}（${week}）`;


            const itemIcon =
                getWeatherIcon(
                    item.weather
                );


            const itemMax =
                item.max_temp !== null &&
                    item.max_temp !== undefined
                    ? `${item.max_temp}°`
                    : "--";


            const itemMin =
                item.min_temp !== null &&
                    item.min_temp !== undefined
                    ? `${item.min_temp}°`
                    : "--";


            const itemPop =
                item.pop !== null &&
                    item.pop !== undefined
                    ? `${item.pop}%`
                    : "--";


            forecastHTML += `

                <div class="forecast-item">

                    <div class="forecast-icon">
                        ${itemIcon}
                    </div>


                    <div class="forecast-content">

                        <div class="forecast-time">
                            ${dateText}
                        </div>

                        <div class="forecast-weather">
                            ${item.weather || "未知"}
                        </div>

                    </div>


                    <div class="forecast-temp">

                        ${itemMin}

                        <span>
                            /
                        </span>

                        ${itemMax}

                    </div>


                    <div class="forecast-pop">
                        💧 ${itemPop}
                    </div>

                </div>

            `;
        }
    );


    // --------------------------------------
    // 更新右側面板
    // --------------------------------------

    panel.innerHTML = `

        <div class="weather-detail">


            <!-- 鄉鎮名稱 -->

            <div class="detail-location">

                ${cityName}・${townshipName}

            </div>


            <!-- 天氣 Icon -->

            <div class="detail-weather-icon">

                ${weatherIcon}

            </div>


            <!-- 天氣 -->

            <div class="detail-weather">

                ${weather}

            </div>


            <!-- 最高溫 -->

            <div class="detail-temp">

                ${maxTemp}

            </div>


            <!-- 溫度範圍 -->

            <div class="detail-range">

                低溫 ${minTemp}

                <span>
                    •
                </span>

                高溫 ${maxTemp}

            </div>


            <div class="detail-divider">
            </div>


            <!-- 天氣資訊 -->

            <div class="detail-info">


                <div class="info-item">

                    <span>
                        💧
                    </span>

                    <div>

                        <small>
                            降雨機率
                        </small>

                        <strong>
                            ${pop}
                        </strong>

                    </div>

                </div>


                <div class="info-item">

                    <span>
                        🌡️
                    </span>

                    <div>

                        <small>
                            溫度範圍
                        </small>

                        <strong>
                            ${minTemp} ～ ${maxTemp}
                        </strong>

                    </div>

                </div>


            </div>


            <div class="detail-divider">
            </div>


            <!-- 未來預報 -->

            <div class="forecast-title">

                未來預報

            </div>


            <div class="forecast-list">

                ${forecastHTML}

            </div>


        </div>

    `;
}

function renderWeeklyForecastList(locationData) {

    const container =
        document.getElementById(
            "weekly-forecast-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const weekNames = [
        "日",
        "一",
        "二",
        "三",
        "四",
        "五",
        "六"
    ];

    locationData.forEach(
        (item, index) => {

            const [
                year,
                month,
                day
            ] =
                item.forecast_date
                    .split("-")
                    .map(Number);

            const date = new Date(
                year,
                month - 1,
                day
            );

            const week =
                weekNames[
                date.getDay()
                ];

            const dateText =
                index === 0
                    ? `明天 ${month}/${day}`
                    : `${month}/${day}（${week}）`;

            const weatherIcon =
                getOverviewWeatherIcon(
                    item.weather_code
                );

            const maxTemp =
                item.max_temp !== null
                    ? `${item.max_temp}°`
                    : "—";

            const minTemp =
                item.min_temp !== null
                    ? `${item.min_temp}°`
                    : "—";

            const pop =
                item.pop !== null
                    ? `${item.pop}%`
                    : "—";

            const itemElement =
                document.createElement("div");

            itemElement.className =
                "weekly-forecast-item";

            itemElement.innerHTML = `
                <div class="weekly-forecast-date">
                    ${dateText}
                </div>

                <div class="weekly-forecast-icon">
                    ${weatherIcon}
                </div>

                <div class="weekly-forecast-weather">
                    ${item.weather || "—"}
                </div>

                <div class="weekly-forecast-temp">
                    <strong>${maxTemp}</strong>
                    <span>${minTemp}</span>
                </div>

                <div class="weekly-forecast-pop">
                    💧 ${pop}
                </div>
            `;

            container.appendChild(
                itemElement
            );

        }
    );
}

// ==========================================
// 綁定縣市選單
// ==========================================

function initializeOverviewEvents() {

    const select =
        document.getElementById(
            "overview-location"
        );

    if (select) {

        select.addEventListener(
            "change",
            event => {

                const locationName =
                    event.target.value;

                if (!locationName) {
                    return;
                }

                // 更新 7 天概覽
                updateOverview(
                    locationName
                );

                // 同步地圖 Marker
                selectLocationFromOverview(
                    locationName
                );

            }
        );

    }


    // ==========================================
    // 全台天氣概覽：收合 / 展開
    // ==========================================

    const overview =
        document.getElementById(
            "weekly-overview"
        );

    const toggle =
        document.getElementById(
            "overview-toggle"
        );

    if (!overview || !toggle) {
        return;
    }

    const isMobile =
        window.innerWidth <= 768;

    if (isMobile) {

        overview.classList.add(
            "collapsed"
        );

        toggle.textContent = "+";

    }

    toggle.addEventListener(
        "click",
        () => {

            const isCollapsed =
                overview.classList.toggle(
                    "collapsed"
                );

            if (isCollapsed) {

                toggle.textContent = "+";

            } else {

                toggle.textContent = "−";

            }

        }
    );

}

function selectLocationFromOverview(
    locationName
) {

    const marker =
        markers[locationName];

    if (!marker) {

        console.warn(
            "找不到對應 Marker：",
            locationName
        );

        return;
    }

    // 移動地圖
    map.setView(
        marker.getLatLng(),
        9,
        {
            animate: true
        }
    );

    // 模擬點擊 Marker
    marker.fire("click");
}

// ========================================
// 台灣天氣地圖
// ========================================

let selectedMarker = null;


// ========================================
// 取得縣市資料
// ========================================

async function loadLocations() {

    const response = await fetch(
        "/api/locations"
    );

    if (!response.ok) {
        throw new Error(
            "取得縣市資料失敗"
        );
    }

    const result =
        await response.json();

    return Array.isArray(result.data)
        ? result.data
        : [];
}


// ========================================
// 取得天氣資料
// ========================================

async function loadWeather() {

    const response = await fetch(
        "/api/weather"
    );

    if (!response.ok) {
        throw new Error(
            "取得天氣資料失敗"
        );
    }

    const result =
        await response.json();

    return Array.isArray(result.data)
        ? result.data
        : [];
}


// ========================================
// 清除 Marker
// ========================================

function clearMarkers() {

    Object.values(markers).forEach(
        (marker) => {

            map.removeLayer(marker);

        }
    );


    Object.keys(markers).forEach(
        (key) => {

            delete markers[key];

        }
    );
}


// ========================================
// 建立 Marker
// ========================================

function createMarkers(
    locations,
    weatherData
) {

    locations.forEach(
        (location) => {

            // -----------------------------
            // 找出目前縣市的天氣資料
            // -----------------------------

            const cityWeather =
                weatherData.filter(
                    (weather) =>
                        weather &&
                        weather.location_name ===
                        location.location_name
                );


            // -----------------------------
            // 第一筆作為主要天氣
            // -----------------------------

            const currentWeather =
                cityWeather.length > 0
                    ? cityWeather[0]
                    : null;


            // -----------------------------
            // 天氣文字
            // -----------------------------

            const weather =
                currentWeather &&
                    currentWeather.weather
                    ? currentWeather.weather
                    : "未知";


            // -----------------------------
            // 天氣圖示
            // -----------------------------

            const weatherIcon =
                getWeatherIcon(weather);


            // -----------------------------
            // 最高溫
            // -----------------------------

            const temperature =
                currentWeather &&
                    currentWeather.max_temp !== null &&
                    currentWeather.max_temp !== undefined
                    ? `${currentWeather.max_temp}°`
                    : "--°";


            // -----------------------------
            // 建立自訂 Marker
            // -----------------------------

            const markerIcon =
                L.divIcon({

                    className:
                        "weather-marker-wrapper",

                    html: `
                        <div class="weather-marker">

                            <div class="weather-marker-icon">
                                ${weatherIcon}
                            </div>

                            <div class="weather-marker-city">
                                ${location.location_name}
                            </div>

                            <div class="weather-marker-temp">
                                ${temperature}
                            </div>

                        </div>
                    `,

                    iconSize: [
                        82,
                        82
                    ],

                    iconAnchor: [
                        41,
                        41
                    ]
                });


            const marker =
                L.marker(
                    [
                        location.latitude,
                        location.longitude
                    ],
                    {
                        icon: markerIcon
                    }
                ).addTo(map);


            // -----------------------------
            // Popup
            // -----------------------------

            marker.bindPopup(
                createPopupContent(
                    location,
                    currentWeather
                )
            );


            // -----------------------------
            // 點擊 Marker
            // -----------------------------

            marker.on(
                "click",
                () => {

                    // 移除上一個選取狀態
                    if (selectedMarker) {

                        const previousElement =
                            selectedMarker.getElement();

                        if (previousElement) {

                            const previousWeatherMarker =
                                previousElement.querySelector(
                                    ".weather-marker"
                                );

                            if (previousWeatherMarker) {

                                previousWeatherMarker.classList.remove(
                                    "selected"
                                );

                            }
                        }
                    }


                    // 設定目前 Marker
                    selectedMarker = marker;


                    const currentElement =
                        marker.getElement();


                    if (currentElement) {

                        const currentWeatherMarker =
                            currentElement.querySelector(
                                ".weather-marker"
                            );

                        if (currentWeatherMarker) {

                            currentWeatherMarker.classList.add(
                                "selected"
                            );

                        }
                    }


                    // 顯示右側天氣資訊
                    showWeatherPanel(
                        location,
                        cityWeather
                    );

                    // 同步左上角「全台天氣概覽」
                    const overviewSelect =
                        document.getElementById(
                            "overview-location"
                        );

                    if (overviewSelect) {

                        overviewSelect.value =
                            location.location_name;

                        updateOverview(
                            location.location_name
                        );
                    }

                    if (window.innerWidth <= 768) {

                        const weatherPanel =
                            document.getElementById(
                                "weather-panel"
                            );

                        if (weatherPanel) {

                            setTimeout(() => {

                                weatherPanel.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start"
                                });

                            }, 200);

                        }

                    }

                }
            );


            // -----------------------------
            // 暫存 Marker
            // -----------------------------

            markers[
                location.location_name
            ] = marker;

        }
    );
}


// ========================================
// Popup
// ========================================

function createPopupContent(
    location,
    weather
) {

    if (!weather) {

        return `
            <div class="popup">

                <div class="popup-city">
                    ${location.location_name}
                </div>

                <div class="popup-weather">
                    暫無天氣資料
                </div>

            </div>
        `;
    }


    return `
        <div class="popup">

            <div class="popup-city">
                ${location.location_name}
            </div>

            <div class="popup-weather">
                ${weather.weather || "未知"}
            </div>

            <div class="popup-temp">
                ${weather.min_temp ?? "--"}°C
                ~
                ${weather.max_temp ?? "--"}°C
            </div>

            <div class="popup-pop">
                降雨機率
                ${weather.pop ?? "--"}%
            </div>

        </div>
    `;
}


// ========================================
// 右側天氣資訊
// ========================================

function showWeatherPanel(location, cityWeather) {

    const panel =
        document.getElementById("weather-panel");

    if (!panel) {
        return;
    }

    if (
        !Array.isArray(cityWeather) ||
        cityWeather.length === 0
    ) {
        panel.innerHTML = `
            <div class="panel-empty">

                <div class="panel-icon">
                    🌥️
                </div>

                <h2>
                    ${location.location_name}
                </h2>

                <p>
                    目前沒有可用的天氣資料。
                </p>

            </div>
        `;

        return;
    }


    // -----------------------------
    // 第一個時段作為目前主要天氣
    // -----------------------------

    const current =
        cityWeather[0];


    const weather =
        current.weather || "未知";


    const minTemp =
        current.min_temp !== null
            ? `${current.min_temp}°`
            : "--";


    const maxTemp =
        current.max_temp !== null
            ? `${current.max_temp}°`
            : "--";


    const pop =
        current.pop !== null
            ? `${current.pop}%`
            : "--";


    const comfort =
        current.comfort || "未知";


    // -----------------------------
    // 天氣圖示
    // -----------------------------

    const weatherIcon =
        getWeatherIcon(weather);


    // -----------------------------
    // 更新右側面板
    // -----------------------------

    panel.innerHTML = `

        <div class="weather-detail">

            <div class="detail-location">
                ${location.location_name}
            </div>


            <div class="detail-weather-icon">
                ${weatherIcon}
            </div>


            <div class="detail-weather">
                ${weather}
            </div>


            <div class="detail-temp">
                ${maxTemp}
            </div>


            <div class="detail-range">
                低溫 ${minTemp}
                <span>•</span>
                高溫 ${maxTemp}
            </div>


            <div class="detail-divider"></div>


            <div class="detail-info">

                <div class="info-item">

                    <span>
                        💧
                    </span>

                    <div>

                        <small>
                            降雨機率
                        </small>

                        <strong>
                            ${pop}
                        </strong>

                    </div>

                </div>


                <div class="info-item">

                    <span>
                        🌡️
                    </span>

                    <div>

                        <small>
                            溫度範圍
                        </small>

                        <strong>
                            ${minTemp} ～ ${maxTemp}
                        </strong>

                    </div>

                </div>


                <div class="info-item">

                    <span>
                        😊
                    </span>

                    <div>

                        <small>
                            舒適度
                        </small>

                        <strong>
                            ${comfort}
                        </strong>

                    </div>

                </div>

            </div>

        </div>

    `;
}


// ========================================
// 天氣 Icon
// ========================================

function getWeatherIcon(
    weather
) {

    if (!weather) {
        return "🌤️";
    }


    if (weather.includes("雷")) {
        return "⛈️";
    }


    if (weather.includes("雨")) {
        return "🌧️";
    }


    if (weather.includes("陰")) {
        return "☁️";
    }


    if (weather.includes("晴")) {
        return "☀️";
    }


    return "🌤️";
}

function formatForecastTime(
    startTime,
    endTime
) {

    if (!startTime) {
        return "未知時段";
    }

    const start =
        new Date(
            startTime.replace(" ", "T")
        );

    const end =
        endTime
            ? new Date(
                endTime.replace(" ", "T")
            )
            : null;


    if (
        Number.isNaN(start.getTime())
    ) {
        return startTime;
    }


    const month =
        start.getMonth() + 1;

    const day =
        start.getDate();

    const startHour =
        String(
            start.getHours()
        ).padStart(2, "0");


    if (
        !end ||
        Number.isNaN(end.getTime())
    ) {

        return `${month}/${day} ${startHour}:00`;
    }


    const endHour =
        String(
            end.getHours()
        ).padStart(2, "0");


    return `${month}/${day} ${startHour}:00 - ${endHour}:00`;
}


// ========================================
// 顯示訊息
// ========================================

function showMessage(
    message
) {

    const element =
        document.getElementById(
            "message"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.classList.remove(
        "hidden"
    );


    setTimeout(
        () => {

            element.classList.add(
                "hidden"
            );

        },
        3000
    );
}


// ========================================
// Loading
// ========================================

function setLoading(
    loading
) {

    const loadingElement =
        document.getElementById(
            "loading"
        );

    const button =
        document.getElementById(
            "refresh-btn"
        );


    if (loading) {

        loadingElement.classList.remove(
            "hidden"
        );

        button.disabled = true;

        button.innerHTML = `
            <span id="refresh-icon">
                ↻
            </span>
            更新中...
        `;

    } else {

        loadingElement.classList.add(
            "hidden"
        );

        button.disabled = false;

        button.innerHTML = `
            <span id="refresh-icon">
                ↻
            </span>
            更新資料
        `;

    }
}


// ========================================
// 更新最後更新時間
// ========================================

function updateLastUpdateTime(
    weatherData
) {

    const element =
        document.getElementById(
            "last-update"
        );


    if (!element) {
        return;
    }


    // --------------------------------
    // 防呆
    // --------------------------------

    if (
        !Array.isArray(weatherData) ||
        weatherData.length === 0
    ) {

        element.textContent =
            "尚未更新";

        return;
    }


    // --------------------------------
    // 只保留有 updated_at 的資料
    // --------------------------------

    const validData =
        weatherData.filter(
            (item) => {

                return (
                    item &&
                    typeof item === "object" &&
                    item.updated_at
                );

            }
        );


    if (
        validData.length === 0
    ) {

        element.textContent =
            "尚未更新";

        return;
    }


    // --------------------------------
    // 找出最新更新時間
    // --------------------------------

    let latest =
        validData[0];


    for (
        let i = 1;
        i < validData.length;
        i++
    ) {

        const current =
            validData[i];


        if (
            new Date(
                current.updated_at
            ) >
            new Date(
                latest.updated_at
            )
        ) {

            latest = current;

        }

    }


    // --------------------------------
    // 顯示時間
    // --------------------------------

    const date =
        new Date(
            latest.updated_at
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        element.textContent =
            "尚未更新";

        return;
    }


    element.textContent =
        `最後更新：${date.toLocaleString(
            "zh-TW"
        )}`;
}


// ========================================
// 從 SQLite 重新載入畫面
// ========================================

async function renderWeatherMap() {

    const locations =
        await loadLocations();


    const weatherData =
        await loadWeather();


    console.log(
        "縣市資料：",
        locations
    );


    console.log(
        "天氣資料：",
        weatherData
    );


    console.log(
        `取得 ${locations.length} 個縣市`
    );


    console.log(
        `取得 ${weatherData.length} 筆天氣資料`
    );


    // --------------------------------
    // 清除舊 Marker
    // --------------------------------

    clearMarkers();


    // --------------------------------
    // 建立 Marker
    // --------------------------------

    createMarkers(
        locations,
        weatherData
    );


    // --------------------------------
    // 更新時間
    // --------------------------------

    updateLastUpdateTime(
        weatherData
    );


    return weatherData;
}


// ========================================
// 呼叫 CWA 更新
// ========================================

async function refreshWeatherData() {

    setLoading(true);


    try {

        console.log(
            "開始更新 CWA 資料..."
        );


        // --------------------------------
        // 1. CWA → Flask → SQLite
        // --------------------------------

        const response =
            await fetch(
                "/api/weather/refresh",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({})
                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "更新資料失敗"
            );

        }


        console.log(
            "CWA → SQLite 更新成功"
        );


        // --------------------------------
        // 2. SQLite → Flask → Browser
        // --------------------------------

        await renderWeatherMap();


        // --------------------------------
        // 3. 成功訊息
        // --------------------------------

        showMessage(
            "天氣資料更新成功"
        );


    } catch (error) {

        console.error(
            "更新天氣資料失敗：",
            error
        );


        showMessage(
            `更新失敗：${error.message}`
        );


    } finally {

        setLoading(false);

    }
}


// ========================================
// 初始化
// ========================================

async function initializeWeatherMap() {

    try {

        console.log(
            "開始載入天氣地圖..."
        );


        await renderWeatherMap();


        console.log(
            "天氣地圖載入完成"
        );


    } catch (error) {

        console.error(
            "初始化天氣地圖失敗：",
            error
        );


        showMessage(
            `載入失敗：${error.message}`
        );

    }
}


// ========================================
// DOM Ready
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeWeatherMap();

        // 載入 7 天預報 
        loadWeeklyWeather();

        // 初始化概覽面板事件 
        initializeOverviewEvents();


        const refreshButton =
            document.getElementById(
                "refresh-btn"
            );


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                () => {

                    refreshWeatherData();

                }
            );

        }

    }
);