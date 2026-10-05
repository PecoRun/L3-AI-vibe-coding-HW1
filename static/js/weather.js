// ==========================================
// 地圖模式
// ==========================================

// let currentMapMode = "temperature";


// ==========================================
// 全台天氣概覽
// ==========================================

let weeklyWeatherData = [];
let townshipWeatherData = [];

// 資料庫裡還沒有即時觀測資料時的提示
// （例如剛部署、還沒按過「更新資料」）
const EMPTY_OBSERVATION_HINT =
    "尚無即時觀測資料，請按右上角「更新資料」";

// 頁面載入後，概覽預設顯示的縣市
// （只填概覽面板，不移動地圖、不開啟標記視窗）
const OVERVIEW_DEFAULT_LOCATION = "臺中市";

// 縣市下拉選單的順序：本島依緯度由北到南，離島放最後。
// 寫死在程式裡，不依賴資料庫的資料順序。
const OVERVIEW_LOCATION_ORDER = [
    "基隆市",
    "臺北市",
    "新北市",
    "桃園市",
    "新竹縣",
    "新竹市",
    "宜蘭縣",
    "苗栗縣",
    "臺中市",
    "彰化縣",
    "花蓮縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "臺南市",
    "臺東縣",
    "高雄市",
    "屏東縣",
    "連江縣",
    "金門縣",
    "澎湖縣"
];

// ==========================================
// 載入 7 天預報資料
// ==========================================

// 預報載入狀態："idle" | "loading" | "ready" | "error"
// 還沒 ready 之前，updateOverview 不會動畫面（狀態提示由載入流程負責）
let weeklyLoadState = "idle";

// 每次重新載入預報就 +1，
// 讓 updateOverview 知道舊的渲染結果已經過期
let weeklyDataVersion = 0;

// 目前面板畫的是哪個縣市 / 哪一版資料（避免重複渲染）
let overviewRenderedKey = null;


// ==========================================
// 概覽狀態提示（載入中 / 失敗 / 無資料）
// message 為空字串時隱藏
// ==========================================

function setOverviewStatus(
    message,
    options = {}
) {

    const element =
        document.getElementById(
            "overview-status"
        );

    if (!element) {
        return;
    }

    element.textContent = message || "";

    element.classList.toggle(
        "overview-status-error",
        Boolean(options.isError)
    );

    element.classList.toggle(
        "hidden",
        !message
    );

    if (message && options.retry) {

        const retryButton =
            document.createElement("button");

        retryButton.type = "button";

        retryButton.className =
            "overview-status-retry";

        retryButton.textContent = "重試";

        retryButton.addEventListener(
            "click",
            options.retry
        );

        element.appendChild(retryButton);

    }
}


// 資料庫的 updated_at 轉成 Date：
//   SQLite：'2026-09-30 01:41:51'（UTC，沒有時區標記）
//   Neon  ：'Wed, 30 Sep 2026 01:41:51 GMT'
function parseServerTimestamp(value) {

    if (!value) {
        return null;
    }

    const text = String(value);

    const date =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
            ? new Date(text.replace(" ", "T") + "Z")
            : new Date(text);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}


// ==========================================
// 預報更新時間（超過 1 天沒更新會變成警告色）
// ==========================================

function renderOverviewUpdatedTime() {

    const element =
        document.getElementById(
            "overview-updated"
        );

    if (!element) {
        return;
    }

    let latest = null;

    weeklyWeatherData.forEach(
        item => {

            const date =
                parseServerTimestamp(
                    item.updated_at
                );

            if (date && (!latest || date > latest)) {
                latest = date;
            }

        }
    );

    if (!latest) {

        element.textContent = "";

        element.classList.remove("stale");

        return;
    }

    // 顯示臺灣時間，不受瀏覽器所在時區影響
    const timeText =
        latest.toLocaleString(
            "zh-TW",
            {
                timeZone: "Asia/Taipei",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }
        );

    const ageDays =
        Math.floor(
            (Date.now() - latest.getTime()) /
            86400000
        );

    const isStale = ageDays >= 1;

    element.textContent =
        isStale
            ? `預報更新於 ${timeText}（已 ${ageDays} 天未更新）`
            : `預報更新於 ${timeText}`;

    element.classList.toggle(
        "stale",
        isStale
    );
}


async function loadWeeklyWeather() {

    weeklyLoadState = "loading";

    setOverviewStatus("預報載入中…");

    try {

        const response = await fetch(
            "/api/weather/weekly"
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(
                "取得 7 天預報失敗"
            );
        }

        weeklyWeatherData = result.data;

        weeklyDataVersion++;

        overviewRenderedKey = null;

        weeklyLoadState = "ready";

        console.log(
            "7 天預報載入成功：",
            weeklyWeatherData
        );

        populateOverviewLocations();

        renderOverviewUpdatedTime();

        setOverviewStatus(
            weeklyWeatherData.length
                ? ""
                : "目前沒有預報資料"
        );

        // 預設縣市：只在使用者還沒選任何縣市時套用
        const overviewSelect =
            document.getElementById(
                "overview-location"
            );

        if (overviewSelect && !overviewSelect.value) {

            overviewSelect.value =
                OVERVIEW_DEFAULT_LOCATION;

            // 預設縣市沒有預報資料時，value 會回到空字串
            if (overviewSelect.value) {

                updateOverview(
                    OVERVIEW_DEFAULT_LOCATION
                );

            }

        }

    } catch (error) {

        console.error(
            "載入 7 天預報失敗：",
            error
        );

        weeklyLoadState = "error";

        setOverviewStatus(
            "預報載入失敗",
            {
                isError: true,
                retry: loadWeeklyWeather
            }
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


    // 取得不重複的縣市，並由北到南排序
    // （不在排序清單內的縣市放最後，彼此維持原順序）
    const getOrder = locationName => {

        const index =
            OVERVIEW_LOCATION_ORDER.indexOf(
                locationName
            );

        return index === -1
            ? OVERVIEW_LOCATION_ORDER.length
            : index;

    };

    const locations = [
        ...new Set(
            weeklyWeatherData.map(
                item => item.location_name
            )
        )
    ].sort(
        (a, b) => getOrder(a) - getOrder(b)
    );


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
    const labels = locationData.map(
        item => getOverviewDateLabel(
            item.forecast_date
        )
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

// 更新概覽中的文字；元素不存在時略過
function setOverviewText(id, text) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}


// 沒有資料可顯示時，把摘要 / 圖表 / 列表清成空白狀態
function resetOverviewContent() {

    [
        "overview-location-name",
        "overview-weather",
        "overview-max-temp",
        "overview-min-temp",
        "overview-pop"
    ].forEach(
        id => setOverviewText(id, "—")
    );

    const popUnit =
        document.getElementById(
            "overview-pop-unit"
        );

    if (popUnit) {
        popUnit.classList.add("hidden");
    }

    if (weeklyTemperatureChart) {

        weeklyTemperatureChart.destroy();

        weeklyTemperatureChart = null;

    }

    const list =
        document.getElementById(
            "weekly-forecast-list"
        );

    if (list) {
        list.innerHTML = "";
    }
}


function updateOverview(locationName) {

    if (!locationName) {
        return;
    }

    // 預報還沒載入完成（或載入失敗）：
    // 畫面上已經有狀態提示，不要另外動內容
    if (weeklyLoadState !== "ready") {
        return;
    }

    // 同一個縣市、同一版資料已經畫過就不重畫。
    // 用下拉選單選縣市時會同時觸發「選單 change」與
    // 「模擬點擊標記」，兩邊都會呼叫這個函式
    const renderKey =
        `${locationName}|${weeklyDataVersion}`;

    if (renderKey === overviewRenderedKey) {
        return;
    }


    // 找出該縣市的 7 天資料
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const locationData = weeklyWeatherData
        .filter(item => {
            if (item.location_name !== locationName) {
                return false;
            }

            const forecastDate = new Date(
                item.forecast_date + "T00:00:00"
            );

            return forecastDate > today;
        })
        .sort((a, b) =>
            a.forecast_date.localeCompare(b.forecast_date)
        )
        .slice(0, 7);


    if (locationData.length === 0) {

        console.warn(
            "找不到縣市資料：",
            locationName
        );

        // 不要讓面板停在上一個縣市的內容
        overviewRenderedKey = null;

        resetOverviewContent();

        setOverviewText(
            "overview-location-name",
            locationName
        );

        setOverviewStatus(
            `${locationName}目前沒有可顯示的預報資料`
        );

        return;
    }

    setOverviewStatus("");


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
    // 更新副標題：依實際資料天數與起始日顯示，
    // 天數會隨預報抓取的時間點而不同（6～7 天）
    // ------------------------------------------

    const subtitleElement =
        document.getElementById(
            "overview-subtitle"
        );

    if (subtitleElement) {

        const firstLabel =
            getOverviewDateLabel(
                firstDayData.forecast_date
            );

        const startText =
            firstLabel.startsWith("明天")
                ? "明天"
                : firstLabel.split("（")[0];

        subtitleElement.textContent =
            `${startText}起未來 ${locationData.length} 天天氣`;

    }


    // ------------------------------------------
    // 更新縣市名稱
    // ------------------------------------------

    setOverviewText(
        "overview-location-name",
        locationName
    );


    // ------------------------------------------
    // 更新天氣
    // ------------------------------------------

    setOverviewText(
        "overview-weather",
        firstDayData.weather || "無資料"
    );

    const weatherIconElement =
        document.querySelector(
            ".overview-weather-icon"
        );

    if (weatherIconElement) {
        weatherIconElement.textContent =
            getOverviewWeatherIcon(
                firstDayData.weather_code,
                firstDayData.weather
            );
    }


    // ------------------------------------------
    // 更新最高溫
    // ------------------------------------------

    setOverviewText(
        "overview-max-temp",
        firstDayData.max_temp != null
            ? firstDayData.max_temp
            : "—"
    );


    // ------------------------------------------
    // 更新最低溫
    // ------------------------------------------

    setOverviewText(
        "overview-min-temp",
        firstDayData.min_temp != null
            ? firstDayData.min_temp
            : "—"
    );


    // ------------------------------------------
    // 更新降雨機率
    // CWA 的 7 天預報只提供前幾天的降雨機率，
    // 沒有資料時只顯示「—」，不要留一個孤單的 %
    // ------------------------------------------

    const hasPop =
        firstDayData.pop != null;

    setOverviewText(
        "overview-pop",
        hasPop
            ? firstDayData.pop
            : "—"
    );

    const popUnitElement =
        document.getElementById(
            "overview-pop-unit"
        );

    if (popUnitElement) {

        popUnitElement.classList.toggle(
            "hidden",
            !hasPop
        );

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

    overviewRenderedKey = renderKey;
}

// 天氣圖示
//
// 降水類（雷、雪、雨、霧）用天氣文字判斷：
// CWA 天氣代碼有 40 多種，只靠代碼區間會漏掉
// （例如 08 多雲短暫陣雨、19 晴午後短暫陣雨）。
// 晴 / 多雲 / 陰則用代碼分出較細的圖示。
function getOverviewWeatherIcon(
    weatherCode,
    weatherText
) {

    const text =
        weatherText || "";

    if (text.includes("雷")) {
        return "⛈️";
    }

    if (text.includes("雪")) {
        return "❄️";
    }

    if (text.includes("雨")) {

        // 晴天或多雲時的短暫陣雨
        return text.includes("晴")
            ? "🌦️"
            : "🌧️";

    }

    if (text.includes("霧")) {
        return "🌫️";
    }

    const code = parseInt(
        weatherCode,
        10
    );

    if (code === 1) {
        return "☀️";
    }

    if (code === 2) {
        return "🌤️";
    }

    if (code >= 3 && code <= 4) {
        return "⛅";
    }

    if (code >= 5 && code <= 7) {
        return "☁️";
    }

    // 代碼不在上面的範圍：改看文字，
    // 文字也沒有才顯示預設圖示
    return text
        ? getWeatherIcon(text)
        : "🌡️";
}


// 臺灣時間的今天，格式 YYYY-MM-DD。
// 不能用 new Date().toISOString()：那是 UTC 日期，
// 臺灣時間 00:00～08:00 會變成前一天。
function getTaiwanDateString() {

    // sv-SE 的日期格式剛好是 YYYY-MM-DD
    return new Date().toLocaleDateString(
        "sv-SE",
        { timeZone: "Asia/Taipei" }
    );
}


// 概覽的日期標籤：
// 只有真的是明天才寫「明天」，其他顯示日期與星期。
// 預報資料過期時，不會把舊日期標成明天。
function getOverviewDateLabel(dateString) {

    const [year, month, day] =
        dateString
            .split("-")
            .map(Number);

    const date =
        new Date(year, month - 1, day);

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const diffDays =
        Math.round(
            (date - today) / 86400000
        );

    if (diffDays === 1) {
        return `明天 ${month}/${day}`;
    }

    const week =
        ["日", "一", "二", "三", "四", "五", "六"][
        date.getDay()
        ];

    return `${month}/${day}（${week}）`;
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

        showTownshipWeatherFloatingPanel(
            cityName,
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

// ==========================================
// 顯示鄉鎮天氣浮動面板
// ==========================================

function showTownshipWeatherFloatingPanel(
    cityName,
    townshipName,
    weatherData
) {
    const oldPopup =
        document.getElementById(
            "township-weather-popup"
        );

    if (oldPopup) {
        oldPopup.remove();
    }

    if (
        !weatherData ||
        weatherData.length === 0
    ) {
        return;
    }

    const sortedData =
        [...weatherData].sort(
            (a, b) =>
                new Date(a.forecast_date) -
                new Date(b.forecast_date)
        );

    const today =
        getTaiwanDateString();

    const todayData =
        sortedData.find(
            item =>
                item.forecast_date === today
        ) ||
        sortedData[0];

    const weatherIcon =
        getOverviewWeatherIcon(
            todayData.weather_code,
            todayData.weather
        );

    const popup =
        document.createElement("div");

    popup.id =
        "township-weather-popup";

    popup.className =
        "township-weather-popup";

    popup.innerHTML = `
        <div class="township-popup-header">

            <div>
                <div class="township-popup-location">
                    ${townshipName}
                </div>

                <div class="township-popup-city">
                    ${cityName}
                </div>
            </div>

            <button
                class="township-popup-close"
                type="button"
                aria-label="關閉"
            >
                ×
            </button>

        </div>

        <div class="township-popup-current">

            <div class="township-popup-icon">
                ${weatherIcon}
            </div>

            <div class="township-popup-weather">
                ${todayData.weather || "—"}
            </div>

            <div class="township-popup-temp">
                ${todayData.max_temp ?? "—"}°
            </div>

        </div>

        <div class="township-popup-info">

            <div class="township-popup-info-item">
                <div class="township-popup-info-label">
                    最低溫
                </div>

                <div class="township-popup-info-value">
                    ${todayData.min_temp ?? "—"}°
                </div>
            </div>

            <div class="township-popup-info-item">
                <div class="township-popup-info-label">
                    降雨機率
                </div>

                <div class="township-popup-info-value">
                    ${todayData.pop ?? "—"}%
                </div>
            </div>

        </div>
    `;

    const mapWrapper =
        document.querySelector(
            ".map-wrapper"
        );

    if (!mapWrapper) {
        return;
    }

    mapWrapper.appendChild(popup);

    const closeButton =
        popup.querySelector(
            ".township-popup-close"
        );

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            () => {
                popup.remove();

                if (
                    typeof selectedTownshipMarker !==
                    "undefined"
                ) {
                    selectedTownshipMarker = null;
                }
            }
        );
    }
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

    locationData.forEach(
        item => {

            const dateText =
                getOverviewDateLabel(
                    item.forecast_date
                );

            const weatherIcon =
                getOverviewWeatherIcon(
                    item.weather_code,
                    item.weather
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
                    ${escapeWindHtml(item.weather) || "—"}
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
// 地圖模式控制
// ========================================

function setMapMode(mode) {

    const previousMapMode = currentMapMode;

    currentMapMode = mode;

    console.log(
        "切換地圖模式：",
        currentMapMode
    );


    // ------------------------------------
    // 更新右側按鈕狀態
    // ------------------------------------

    updateMapLayerButtons();


    // ------------------------------------
    // 左側「全台天氣概覽」只在氣溫模式顯示
    // ------------------------------------

    const weeklyOverview =
        document.getElementById(
            "weekly-overview"
        );

    if (weeklyOverview) {

        weeklyOverview.classList.toggle(
            "hidden",
            mode !== "temperature"
        );

    }


    // ------------------------------------
    // 切換圖層前
    // 先移除所有天氣 Marker
    // ------------------------------------

    if (
        typeof clearWeatherMarkers ===
        "function"
    ) {

        clearWeatherMarkers();

    }

    // 清除風向圖層與圖例，並讓進行中的請求失效
    clearWindLayer();

    clearTyphoonLayer();

    // 離開颱風圖層時，視野回到臺灣
    // （颱風模式會把地圖拉到颱風所在位置）
    if (
        previousMapMode === "typhoon" &&
        mode !== "typhoon"
    ) {

        resetToTaiwanView();

    }


    // ------------------------------------
    // 關閉鄉鎮天氣浮動面板
    // ------------------------------------

    const townshipPopup =
        document.getElementById(
            "township-weather-popup"
        );

    if (townshipPopup) {

        townshipPopup.remove();

    }


    // 清除目前選取的 Marker

    selectedMarker = null;

    selectedTownshipMarker = null;


    // ------------------------------------
    // 氣溫模式
    // ------------------------------------

    if (mode === "temperature") {

        removeMapModeMessage();

        updateTownshipMarkers();

        return;

    }


    // ------------------------------------
    // 颱風資訊
    // ------------------------------------

    if (mode === "typhoon") {

        renderTyphoonMapMode();

        return;

    }


    // ------------------------------------
    // 風速風向
    // ------------------------------------

    if (mode === "wind") {

        renderWindMapMode();

        return;

    }

}


// ========================================
// 更新右側按鈕狀態
// ========================================

function updateMapLayerButtons() {

    const buttons =
        document.querySelectorAll(
            ".map-layer-btn"
        );


    buttons.forEach(
        button => {

            const mode =
                button.dataset.mapMode;


            button.classList.toggle(
                "active",
                mode === currentMapMode
            );

        }
    );

}


// ========================================
// 風速風向模式
// 資料來源：CWA O-A0003-001 即時觀測
// ========================================

// 所有風向 Marker 都放在這個 LayerGroup，
// 切換圖層時可以一次清除
const windLayer = L.layerGroup();

// 最近一次取得的測站資料（縮放 / 平移時重繪用）
let windObservationData = [];

// 用來丟棄過期的 fetch 結果
let windRequestId = 0;

// 測站稀疏化：每個 WIND_CELL_SIZE px 的格子最多顯示一個測站
const WIND_CELL_SIZE = 56;

// 風速色階（蒲福風級）
// maxLevel：該色階涵蓋到的最大風級
const WIND_COLOR_STEPS = [
    { maxLevel: 2, color: "#30b0c7", label: "0–2 級" },
    { maxLevel: 4, color: "#34c759", label: "3–4 級" },
    { maxLevel: 6, color: "#ff9f0a", label: "5–6 級" },
    { maxLevel: 8, color: "#ff3b30", label: "7–8 級" },
    { maxLevel: Infinity, color: "#af52de", label: "9 級以上" }
];

// 蒲福風級上限（m/s），索引 = 風級
const BEAUFORT_LIMITS = [
    0.3, 1.6, 3.4, 5.5, 8.0, 10.8,
    13.9, 17.2, 20.8, 24.5, 28.5, 32.7
];

const WIND_DIRECTION_NAMES = [
    "北", "北北東", "東北", "東北東",
    "東", "東南東", "東南", "南南東",
    "南", "南南西", "西南", "西南西",
    "西", "西北西", "西北", "北北西"
];

let windLegendControl = null;


function getBeaufortLevel(speed) {

    const index =
        BEAUFORT_LIMITS.findIndex(
            limit => speed < limit
        );

    return index === -1
        ? BEAUFORT_LIMITS.length
        : index;
}


function getWindColor(level) {

    return WIND_COLOR_STEPS.find(
        step => level <= step.maxLevel
    ).color;
}


// CWA 風向：0–360 度，代表「風從哪裡吹來」。
// 小於 0（-99 等）或超過 360 視為無效
function isValidWindDirection(direction) {

    return (
        Number.isFinite(direction) &&
        direction >= 0 &&
        direction <= 360
    );
}


function getWindDirectionName(direction) {

    const index =
        Math.round(direction / 22.5) % 16;

    return `${WIND_DIRECTION_NAMES[index]}風`;
}


// 2026-10-01T09:30:00+08:00 → 2026-10-01 09:30:00
// CWA 時間本身就是臺灣時間，直接調整字串，不做時區換算
function formatObservationTime(value) {

    if (!value) {
        return "—";
    }

    return String(value)
        .replace("T", " ")
        .replace(/(Z|[+-]\d{2}:?\d{2})$/, "")
        .trim();
}


function escapeWindHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


// ========================================
// 清除風向圖層
// ========================================

function clearWindLayer() {

    // 讓還沒回來的 fetch 結果失效
    windRequestId++;

    windLayer.clearLayers();

    if (map.hasLayer(windLayer)) {

        map.removeLayer(windLayer);

    }

    if (windLegendControl) {

        map.removeControl(windLegendControl);

        windLegendControl = null;

    }
}


// ========================================
// 風速風向圖例
// ========================================

function addWindLegend() {

    if (windLegendControl) {
        return;
    }

    windLegendControl =
        L.control({
            position: "bottomright"
        });

    windLegendControl.onAdd = () => {

        const container =
            L.DomUtil.create(
                "div",
                "wind-legend"
            );

        const rows =
            WIND_COLOR_STEPS.map(
                step => `
                    <div class="wind-legend-row">
                        <span
                            class="wind-legend-color"
                            style="background:${step.color}"
                        ></span>
                        ${step.label}
                    </div>
                `
            ).join("");

        container.innerHTML = `
            <div class="wind-legend-title">
                風速（蒲福風級）
            </div>
            ${rows}
            <div class="wind-legend-note">
                箭頭指向風吹去的方向
            </div>
        `;

        return container;
    };

    windLegendControl.addTo(map);
}


// ========================================
// 載入風速風向資料
// ========================================

async function renderWindMapMode() {

    console.log(
        "目前為風速風向模式"
    );

    removeMapModeMessage();

    const requestId = ++windRequestId;

    try {

        const response =
            await fetch(
                "/api/weather/observation"
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                "取得即時觀測資料失敗"
            );

        }

        // 等待期間使用者已切到其他圖層
        if (
            requestId !== windRequestId ||
            currentMapMode !== "wind"
        ) {
            return;
        }

        console.log(
            "即時觀測資料：",
            result.count,
            "筆"
        );

        windObservationData =
            result.data;

        // 資料庫還沒有任何觀測資料（尚未按過「更新資料」）
        if (!windObservationData.length) {

            showMapModeMessage(
                "💨 風速風向",
                EMPTY_OBSERVATION_HINT,
                0
            );

            return;
        }

        addWindLegend();

        renderWindMarkers();

    } catch (error) {

        console.error(
            "載入風速風向資料失敗：",
            error
        );

        if (
            requestId !== windRequestId ||
            currentMapMode !== "wind"
        ) {
            return;
        }

        showMapModeMessage(
            "💨 風速風向",
            "即時風速風向資料載入失敗"
        );

    }
}


// ========================================
// 挑選要顯示的測站
// 同一個格子只留風速最大的測站，
// 縮放後格子涵蓋的實際範圍變小，測站就會變多
// ========================================

function pickWindStations(observationData) {

    const zoom = map.getZoom();

    const cells = new Map();

    observationData.forEach(
        observation => {

            const latitude =
                Number(observation.latitude);

            const longitude =
                Number(observation.longitude);

            const windSpeed =
                Number(observation.wind_speed);

            if (
                observation.latitude == null ||
                observation.longitude == null ||
                observation.wind_speed == null ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                !Number.isFinite(windSpeed) ||
                windSpeed < 0
            ) {
                return;
            }

            const point =
                map.project(
                    [latitude, longitude],
                    zoom
                );

            const key =
                Math.floor(point.x / WIND_CELL_SIZE) +
                "," +
                Math.floor(point.y / WIND_CELL_SIZE);

            const current =
                cells.get(key);

            if (
                !current ||
                windSpeed > current.windSpeed
            ) {

                cells.set(
                    key,
                    {
                        observation,
                        latitude,
                        longitude,
                        windSpeed
                    }
                );

            }
        }
    );

    return Array.from(cells.values());
}


// ========================================
// 建立風速風向 Marker
// ========================================

function renderWindMarkers() {

    windLayer.clearLayers();

    if (!map.hasLayer(windLayer)) {

        windLayer.addTo(map);

    }

    const bounds =
        map.getBounds().pad(0.2);

    const stations =
        pickWindStations(
            windObservationData
        ).filter(
            station => bounds.contains([
                station.latitude,
                station.longitude
            ])
        );

    stations.forEach(
        ({
            observation,
            latitude,
            longitude,
            windSpeed
        }) => {

            const windDirection =
                observation.wind_direction == null
                    ? NaN
                    : Number(
                        observation.wind_direction
                    );

            const hasDirection =
                isValidWindDirection(
                    windDirection
                );

            const level =
                getBeaufortLevel(windSpeed);

            const color =
                getWindColor(level);

            // 無風，或沒有有效風向：不畫箭頭
            const showArrow =
                hasDirection &&
                windSpeed >= BEAUFORT_LIMITS[0];

            // CWA 風向代表「風從哪裡吹來」，
            // 箭頭要指向「風吹往哪裡」，因此轉 180 度
            const arrowAngle =
                (windDirection + 180) % 360;

            const icon =
                L.divIcon({

                    className:
                        "wind-marker-wrapper",

                    html: `
                        <div
                            class="wind-marker"
                            style="
                                color: ${color};
                                border-color: ${color};
                            "
                        >
                            <span
                                class="wind-arrow"
                                style="
                                    transform:
                                        rotate(${arrowAngle}deg);
                                "
                            >${showArrow ? "↑" : "•"}</span>
                        </div>

                        <div class="wind-speed">
                            ${windSpeed.toFixed(1)} m/s
                        </div>
                    `,

                    iconSize: [70, 55],

                    iconAnchor: [35, 15]

                });

            const marker =
                L.marker(
                    [latitude, longitude],
                    {
                        icon: icon
                    }
                );

            const stationName =
                escapeWindHtml(
                    observation.station_name
                );

            const place =
                escapeWindHtml(
                    [
                        observation.city_name,
                        observation.township_name
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

            const gust =
                Number(
                    observation.peak_gust_speed
                );

            const gustRow =
                observation.peak_gust_speed != null &&
                Number.isFinite(gust) &&
                gust >= 0
                    ? `<div>最大陣風：${gust.toFixed(1)} m/s</div>`
                    : "";

            const directionText =
                hasDirection
                    ? `${getWindDirectionName(windDirection)}（${windDirection.toFixed(0)}°）`
                    : "—";

            marker.bindPopup(`
                <div class="wind-popup">
                    <strong>${stationName}</strong>
                    <div class="wind-popup-place">
                        ${place}
                    </div>
                    <div>
                        風速：${windSpeed.toFixed(1)} m/s
                        （${level} 級）
                    </div>
                    <div>風向：${directionText}</div>
                    ${gustRow}
                    <div class="wind-popup-time">
                        ${escapeWindHtml(
                            formatObservationTime(
                                observation.observation_time
                            )
                        )}
                    </div>
                </div>
            `);

            marker.bindTooltip(
                stationName,
                {
                    direction: "top",
                    offset: [0, -12]
                }
            );

            marker.addTo(windLayer);
        }
    );

    console.log(
        "風速風向 Marker 建立完成：",
        stations.length,
        "筆"
    );
}


// 縮放 / 平移後重新挑選要顯示的測站
// （zoom 結束時 Leaflet 也會觸發 moveend）
map.on(
    "moveend",
    () => {

        if (
            currentMapMode === "wind" &&
            windObservationData.length
        ) {

            renderWindMarkers();

        }

    }
);


// ========================================
// 颱風模式
// 資料來源：CWA W-C0034-005 熱帶氣旋路徑與預報
// 由後端 /api/typhoon 提供，不存資料庫
// ========================================

// 所有颱風的路徑 / 暴風圈 / 標記都放在這個 LayerGroup
const typhoonLayer = L.layerGroup();

// 所有路徑與暴風圈的範圍（「縮放至颱風」用）
let typhoonBounds = null;

let typhoonRefreshTimer = null;

// 用來丟棄過期的 fetch 結果
let typhoonRequestId = 0;

// CWA 颱風資料約 3–6 小時更新一次，10 分鐘檢查一次就夠
const TYPHOON_REFRESH_MS = 10 * 60 * 1000;

// 臺灣預設視野（與 map.js 初始化一致）
const TAIWAN_VIEW = {
    center: [23.7, 120.9],
    zoom: 8
};

// 強度分級（臺灣分類，依近中心最大風速 m/s）
const TYPHOON_INTENSITIES = [
    { minWind: 51.0, label: "強烈颱風", color: "#af52de" },
    { minWind: 32.7, label: "中度颱風", color: "#ff3b30" },
    { minWind: 17.2, label: "輕度颱風", color: "#ff9f0a" },
    { minWind: 0, label: "熱帶性低氣壓", color: "#8e8e93" }
];

const TYPHOON_UNKNOWN_INTENSITY = {
    label: "強度未知",
    color: "#8e8e93"
};


function getTyphoonIntensity(windSpeed) {

    if (windSpeed == null || !Number.isFinite(windSpeed)) {
        return TYPHOON_UNKNOWN_INTENSITY;
    }

    return TYPHOON_INTENSITIES.find(
        level => windSpeed >= level.minWind
    ) || TYPHOON_UNKNOWN_INTENSITY;
}


// 數值 + 單位，缺值顯示「—」
function formatTyphoonValue(value, unit) {

    if (value == null || !Number.isFinite(value)) {
        return "—";
    }

    return `${value} ${unit}`;
}


function formatTyphoonPosition(point) {

    return (
        `${point.latitude.toFixed(1)}°N ` +
        `${point.longitude.toFixed(1)}°E`
    );
}


// ========================================
// 清除颱風圖層
// ========================================

function clearTyphoonLayer() {

    // 讓還沒回來的 fetch 結果失效
    typhoonRequestId++;

    if (typhoonRefreshTimer) {

        clearInterval(typhoonRefreshTimer);

        typhoonRefreshTimer = null;

    }

    typhoonLayer.clearLayers();

    if (map.hasLayer(typhoonLayer)) {

        map.removeLayer(typhoonLayer);

    }

    typhoonBounds = null;

    const panel =
        document.getElementById(
            "typhoon-panel"
        );

    if (panel) {

        panel.remove();

    }
}


// ========================================
// 地圖視野
// ========================================

function fitTyphoonView() {

    if (!typhoonBounds || !typhoonBounds.isValid()) {
        return;
    }

    const isMobile =
        window.innerWidth <= 768;

    // 桌機版左側有資訊卡，預留空間避免颱風被蓋住
    map.fitBounds(
        typhoonBounds,
        {
            paddingTopLeft: [
                isMobile ? 20 : 360,
                40
            ],
            paddingBottomRight: [40, 40],
            maxZoom: 7
        }
    );
}


function resetToTaiwanView() {

    map.setView(
        TAIWAN_VIEW.center,
        TAIWAN_VIEW.zoom
    );
}


// ========================================
// 繪製單一颱風
// ========================================

function drawTyphoon(typhoon) {

    const latest = typhoon.latest;

    const latestIntensity =
        getTyphoonIntensity(
            latest.max_wind_speed
        );

    const displayName =
        typhoon.name_zh ||
        typhoon.name_en ||
        "熱帶氣旋";

    const latestLatLng =
        [latest.latitude, latest.longitude];

    // --------------------------------
    // 暴風圈（目前位置）
    // 七級風在下、十級風在上
    // --------------------------------

    [
        {
            radius: latest.radius_7,
            color: "#ff9f0a",
            fillOpacity: 0.14
        },
        {
            radius: latest.radius_10,
            color: "#ff3b30",
            fillOpacity: 0.22
        }
    ].forEach(
        ({ radius, color, fillOpacity }) => {

            if (!radius || radius <= 0) {
                return;
            }

            const circle =
                L.circle(
                    latestLatLng,
                    {
                        radius: radius * 1000,
                        color: color,
                        weight: 1.5,
                        fillColor: color,
                        fillOpacity: fillOpacity,
                        interactive: false
                    }
                ).addTo(typhoonLayer);

            typhoonBounds.extend(
                circle.getBounds()
            );

        }
    );

    // --------------------------------
    // 過去路徑（實線）
    // --------------------------------

    L.polyline(
        typhoon.track.map(
            point => [
                point.latitude,
                point.longitude
            ]
        ),
        {
            color: "#636366",
            weight: 3,
            opacity: 0.9,
            interactive: false
        }
    ).addTo(typhoonLayer);

    typhoon.track.forEach(
        point => {

            const intensity =
                getTyphoonIntensity(
                    point.max_wind_speed
                );

            typhoonBounds.extend(
                [point.latitude, point.longitude]
            );

            L.circleMarker(
                [point.latitude, point.longitude],
                {
                    radius: 4,
                    color: "#ffffff",
                    weight: 1,
                    fillColor: intensity.color,
                    fillOpacity: 1
                }
            )
                .bindPopup(`
                    <div class="typhoon-popup">
                        <strong>${escapeWindHtml(displayName)}</strong>
                        <div class="typhoon-popup-time">
                            ${escapeWindHtml(formatObservationTime(point.time))}
                        </div>
                        <div>${intensity.label}</div>
                        <div>最大風速：${formatTyphoonValue(point.max_wind_speed, "m/s")}</div>
                        <div>中心氣壓：${formatTyphoonValue(point.pressure, "hPa")}</div>
                    </div>
                `)
                .addTo(typhoonLayer);

        }
    );

    // --------------------------------
    // 預報路徑（虛線）+ 70% 機率圈
    // --------------------------------

    if (typhoon.forecast.length) {

        L.polyline(
            [
                latestLatLng,
                ...typhoon.forecast.map(
                    point => [
                        point.latitude,
                        point.longitude
                    ]
                )
            ],
            {
                color: "#636366",
                weight: 2.5,
                opacity: 0.9,
                dashArray: "6 6",
                interactive: false
            }
        ).addTo(typhoonLayer);

    }

    typhoon.forecast.forEach(
        point => {

            const intensity =
                getTyphoonIntensity(
                    point.max_wind_speed
                );

            typhoonBounds.extend(
                [point.latitude, point.longitude]
            );

            if (point.radius_70 && point.radius_70 > 0) {

                const probabilityCircle =
                    L.circle(
                        [point.latitude, point.longitude],
                        {
                            radius: point.radius_70 * 1000,
                            color: "#636366",
                            weight: 1,
                            dashArray: "4 4",
                            fillColor: "#636366",
                            fillOpacity: 0.06,
                            interactive: false
                        }
                    ).addTo(typhoonLayer);

                typhoonBounds.extend(
                    probabilityCircle.getBounds()
                );

            }

            L.circleMarker(
                [point.latitude, point.longitude],
                {
                    radius: 5,
                    color: intensity.color,
                    weight: 2,
                    fillColor: "#ffffff",
                    fillOpacity: 1
                }
            )
                .bindPopup(`
                    <div class="typhoon-popup">
                        <strong>${escapeWindHtml(displayName)}（預報）</strong>
                        <div class="typhoon-popup-time">
                            ${escapeWindHtml(formatObservationTime(point.time))}
                            （+${point.forecast_hour ?? "?"} 小時）
                        </div>
                        <div>${intensity.label}</div>
                        <div>最大風速：${formatTyphoonValue(point.max_wind_speed, "m/s")}</div>
                        <div>中心氣壓：${formatTyphoonValue(point.pressure, "hPa")}</div>
                        <div>70% 機率圈半徑：${formatTyphoonValue(point.radius_70, "km")}</div>
                    </div>
                `)
                .addTo(typhoonLayer);

        }
    );

    // --------------------------------
    // 目前位置 🌀
    // --------------------------------

    L.marker(
        latestLatLng,
        {
            icon: L.divIcon({
                className: "typhoon-marker-wrapper",
                html: `<div class="typhoon-marker" style="border-color:${latestIntensity.color}">🌀</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            }),
            zIndexOffset: 1000
        }
    )
        .bindTooltip(
            escapeWindHtml(displayName),
            {
                permanent: true,
                direction: "right",
                offset: [14, 0],
                className: "typhoon-label"
            }
        )
        .addTo(typhoonLayer);
}


// ========================================
// 左側颱風資訊卡
// （颱風模式下「全台天氣概覽」已隱藏，借用同一個位置）
// ========================================

function renderTyphoonPanel(typhoons) {

    let panel =
        document.getElementById(
            "typhoon-panel"
        );

    if (!panel) {

        panel =
            document.createElement("div");

        panel.id = "typhoon-panel";

        panel.className = "typhoon-panel";

        const mapWrapper =
            document.querySelector(
                ".map-wrapper"
            );

        if (!mapWrapper) {
            return;
        }

        mapWrapper.appendChild(panel);

    }

    const row = (label, value) => `
        <div class="typhoon-stat">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `;

    const cards =
        typhoons.map(
            typhoon => {

                const latest = typhoon.latest;

                const intensity =
                    getTyphoonIntensity(
                        latest.max_wind_speed
                    );

                const numberText =
                    typhoon.ty_no
                        ? `第 ${escapeWindHtml(typhoon.ty_no)} 號颱風`
                        : typhoon.td_no
                            ? `第 ${escapeWindHtml(typhoon.td_no)} 號熱帶性低氣壓`
                            : "";

                return `
                    <div class="typhoon-card">

                        <div class="typhoon-card-header">

                            <span
                                class="typhoon-badge"
                                style="background:${intensity.color}"
                            >${intensity.label}</span>

                            <strong class="typhoon-name">
                                ${escapeWindHtml(typhoon.name_zh || typhoon.name_en || "熱帶氣旋")}
                            </strong>

                            <span class="typhoon-name-en">
                                ${escapeWindHtml(typhoon.name_zh ? (typhoon.name_en || "") : "")}
                            </span>

                        </div>

                        <div class="typhoon-number">
                            ${numberText}
                        </div>

                        ${row("中心位置", formatTyphoonPosition(latest))}
                        ${row("最大風速", formatTyphoonValue(latest.max_wind_speed, "m/s"))}
                        ${row("瞬間陣風", formatTyphoonValue(latest.max_gust_speed, "m/s"))}
                        ${row("中心氣壓", formatTyphoonValue(latest.pressure, "hPa"))}
                        ${row("七級風半徑", formatTyphoonValue(latest.radius_7, "km"))}
                        ${row("十級風半徑", formatTyphoonValue(latest.radius_10, "km"))}

                        ${latest.moving_text
                            ? `<div class="typhoon-moving">${escapeWindHtml(latest.moving_text)}</div>`
                            : ""
                        }

                        <div class="typhoon-time">
                            資料時間：${escapeWindHtml(formatObservationTime(latest.time))}
                        </div>

                    </div>
                `;
            }
        ).join("");

    const legend =
        TYPHOON_INTENSITIES.map(
            level => `
                <span class="typhoon-legend-item">
                    <span
                        class="typhoon-legend-dot"
                        style="background:${level.color}"
                    ></span>
                    ${level.label}
                </span>
            `
        ).join("");

    panel.innerHTML = `
        <div class="typhoon-panel-header">
            <h2>颱風資訊</h2>
            <p>CWA 熱帶氣旋路徑與預報</p>
        </div>

        <div class="typhoon-panel-body">

            ${typhoons.length
                ? cards
                : `<div class="typhoon-empty">目前沒有活躍的颱風</div>`
            }

            <div class="typhoon-actions">
                ${typhoons.length
                    ? `<button id="typhoon-fit-btn" type="button">縮放至颱風</button>`
                    : ""
                }
                <button id="typhoon-home-btn" type="button">回到臺灣</button>
            </div>

            ${typhoons.length
                ? `
                    <div class="typhoon-legend">${legend}</div>
                    <div class="typhoon-legend-note">
                        實線：過去路徑　虛線：預報路徑與 70% 機率圈<br>
                        橘圈：七級風暴風半徑　紅圈：十級風暴風半徑
                    </div>
                `
                : ""
            }
        </div>
    `;

    const fitButton =
        document.getElementById(
            "typhoon-fit-btn"
        );

    if (fitButton) {

        fitButton.addEventListener(
            "click",
            fitTyphoonView
        );

    }

    document
        .getElementById("typhoon-home-btn")
        .addEventListener(
            "click",
            resetToTaiwanView
        );
}


// ========================================
// 載入颱風資料並繪製
// fitView：是否縮放到颱風（進入圖層時才縮放，
// 定時更新不要搶走使用者目前的視野）
// ========================================

async function loadTyphoonData(requestId, fitView) {

    try {

        const response =
            await fetch("/api/typhoon");

        const result =
            await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                `HTTP ${response.status}`
            );

        }

        // 等待期間使用者已切到其他圖層
        if (
            requestId !== typhoonRequestId ||
            currentMapMode !== "typhoon"
        ) {
            return;
        }

        typhoonLayer.clearLayers();

        if (!map.hasLayer(typhoonLayer)) {

            typhoonLayer.addTo(map);

        }

        typhoonBounds = L.latLngBounds([]);

        result.data.forEach(drawTyphoon);

        renderTyphoonPanel(result.data);

        if (fitView) {

            fitTyphoonView();

        }

    } catch (error) {

        console.error(
            "載入颱風資料失敗：",
            error
        );

        if (
            requestId !== typhoonRequestId ||
            currentMapMode !== "typhoon"
        ) {
            return;
        }

        showMapModeMessage(
            "🌀 颱風資訊",
            "颱風資料載入失敗"
        );

    }
}


function renderTyphoonMapMode() {

    console.log(
        "目前為颱風模式"
    );

    removeMapModeMessage();

    const requestId = ++typhoonRequestId;

    loadTyphoonData(requestId, true);

    typhoonRefreshTimer =
        setInterval(
            () => loadTyphoonData(requestId, false),
            TYPHOON_REFRESH_MS
        );
}


// ========================================
// 地圖模式提示
// ========================================

// 提示訊息預設 2.5 秒後自動消失。
// duration 傳 0 表示不自動消失（需要使用者行動的提示用），
// 切換圖層時由 removeMapModeMessage() 移除。
let mapModeMessageTimer = null;

function showMapModeMessage(
    title,
    description,
    duration = 2500
) {

    let element =
        document.getElementById(
            "map-mode-message"
        );


    // 第一次使用時建立
    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "map-mode-message";

        element.className =
            "map-mode-message";

        const mapWrapper =
            document.querySelector(
                ".map-wrapper"
            );

        if (mapWrapper) {

            mapWrapper.appendChild(
                element
            );

        }

    }


    if (!element) {
        return;
    }


    element.innerHTML = `

        <div class="map-mode-message-title">
            ${title}
        </div>

        <div class="map-mode-message-description">
            ${description}
        </div>

    `;


    element.classList.remove(
        "hidden"
    );


    // 先取消上一則訊息的計時，
    // 避免它把這一則（特別是不自動消失的）提早藏起來
    if (mapModeMessageTimer) {

        clearTimeout(mapModeMessageTimer);

        mapModeMessageTimer = null;

    }

    if (duration > 0) {

        mapModeMessageTimer =
            setTimeout(
                () => {

                    element.classList.add(
                        "hidden"
                    );

                },
                duration
            );

    }

}

// ========================================
// 初始化地圖圖層控制器
// ========================================

function initializeMapLayerControls() {

    const buttons =
        document.querySelectorAll(
            ".map-layer-btn"
        );


    if (!buttons.length) {

        console.warn(
            "找不到地圖圖層按鈕"
        );

        return;
    }


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const mode =
                        button.dataset.mapMode;


                    if (!mode) {
                        return;
                    }


                    setMapMode(mode);

                }
            );

        }
    );


    // 預設為氣溫
    setMapMode("temperature");


    console.log(
        "地圖圖層控制器初始化完成"
    );

}

// ========================================
// 台灣天氣地圖
// ========================================


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
// 取得即時觀測資料
// ========================================

async function loadObservationWeather() {

    const response = await fetch(
        "/api/weather/observation"
    );

    if (!response.ok) {
        throw new Error(
            "取得即時觀測資料失敗"
        );
    }

    const result =
        await response.json();

    if (!result.success) {
        throw new Error(
            result.message ||
            "取得即時觀測資料失敗"
        );
    }

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
// 縣市的即時觀測代表值
// ========================================

// 純數字 / 符號的天氣文字是 CWA 的缺值標記（"-99"、"-"、"/"），不是天氣
function isValidWeatherText(text) {

    return (
        typeof text === "string" &&
        text.trim() !== "" &&
        !/^[-/\d\s.]+$/.test(text.trim())
    );
}


// 回傳 { temperature, weather }，沒有有效資料的欄位為 null
//   temperature：有效測站氣溫的中位數（四捨五入到小數 1 位）
//   weather    ：最常見的天氣文字（次數相同時取先出現的）
function summarizeCityObservations(cityObservations) {

    // 氣溫低於 -50 視為缺值（CWA 用 -99）
    const temperatures =
        cityObservations
            .map(
                observation =>
                    observation.air_temperature == null
                        ? NaN
                        : Number(observation.air_temperature)
            )
            .filter(
                value =>
                    Number.isFinite(value) &&
                    value > -50
            )
            .sort(
                (a, b) => a - b
            );

    let temperature = null;

    if (temperatures.length) {

        const middle =
            Math.floor(temperatures.length / 2);

        const median =
            temperatures.length % 2
                ? temperatures[middle]
                : (
                    temperatures[middle - 1] +
                    temperatures[middle]
                ) / 2;

        temperature =
            Math.round(median * 10) / 10;

    }

    // 統計各天氣文字出現的次數
    // （Map 保留插入順序，次數相同時先出現的排前面）
    const weatherCounts = new Map();

    cityObservations.forEach(
        observation => {

            if (!isValidWeatherText(observation.weather)) {
                return;
            }

            const text =
                observation.weather.trim();

            weatherCounts.set(
                text,
                (weatherCounts.get(text) || 0) + 1
            );

        }
    );

    let weather = null;
    let bestCount = 0;

    weatherCounts.forEach(
        (count, text) => {

            if (count > bestCount) {

                weather = text;
                bestCount = count;

            }

        }
    );

    return {
        temperature,
        weather
    };
}


// ========================================
// 建立 Marker
// ========================================

function createMarkers(
    locations,
    weatherData,
    observationData
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
            // 找出目前縣市的即時觀測資料
            // -----------------------------

            const cityObservations =
                observationData.filter(
                    observation =>
                        observation &&
                        observation.city_name ===
                        location.location_name
                );

            // 縣市的代表值：溫度取各測站的中位數、天氣取最常見的文字。
            // 不能取第一個測站——它可能是山區測站，
            // 會讓整個縣市的溫度偏低好幾度。
            const cityObservationSummary =
                summarizeCityObservations(
                    cityObservations
                );


            // -----------------------------
            // 天氣文字
            // -----------------------------

            const weather =
                cityObservationSummary.weather
                    ? cityObservationSummary.weather
                    : (
                        currentWeather &&
                            currentWeather.weather
                            ? currentWeather.weather
                            : "未知"
                    );


            // -----------------------------
            // 天氣圖示
            // -----------------------------

            const weatherIcon =
                getWeatherIcon(weather);


            // -----------------------------
            // 最高溫
            // -----------------------------

            const temperature =
                cityObservationSummary.temperature !== null
                    ? `${cityObservationSummary.temperature}°`
                    : (
                        currentWeather &&
                            currentWeather.max_temp !== null &&
                            currentWeather.max_temp !== undefined
                            ? `${currentWeather.max_temp}°`
                            : "--°"
                    );


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




            // -----------------------------
            // 點擊 Marker
            // -----------------------------

            marker.on(
                "click",
                () => {

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


                    // --------------------------------------
                    // 點擊縣市後，只更新左側「全台天氣概覽」
                    // --------------------------------------

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


                    // --------------------------------------
                    // 手機版：滾動到左側/概覽區域
                    // --------------------------------------

                    if (window.innerWidth <= 768) {

                        const overviewSection =
                            document.getElementById(
                                "weekly-overview"
                            );

                        if (overviewSection) {

                            setTimeout(() => {

                                overviewSection.scrollIntoView({
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

// 顯示資料的觀測時間，而不是瀏覽器載入頁面的時間，
// 與右側統計卡的「觀測時間」是同一個來源
function updateLastUpdateTime(observationData) {

    const element =
        document.getElementById(
            "last-update"
        );

    if (!element) {
        return;
    }

    const latestTime =
        getLatestObservationTime(
            observationData
        );

    element.textContent =
        latestTime
            ? `最後更新：${formatObservationShortTime(latestTime)}`
            : "尚無即時觀測資料";
}


// ========================================
// 即時觀測統計（右側面板）
// 資料：CWA O-A0003-001，已存在資料庫的測站資料
// ========================================

// 在所有測站中找某個欄位的極值，回傳 { value, station }；
// 沒有任何有效資料時回傳 null。
// CWA 的缺值是負數哨兵值（-99、-990 等），
// isValid 負責把它們排除。
function findObservationExtreme(
    observationData,
    field,
    isValid,
    pick
) {

    let best = null;

    observationData.forEach(
        observation => {

            const raw =
                observation[field];

            if (raw == null) {
                return;
            }

            const value =
                Number(raw);

            if (
                !Number.isFinite(value) ||
                !isValid(value)
            ) {
                return;
            }

            const isBetter =
                best === null ||
                (pick === "max"
                    ? value > best.value
                    : value < best.value);

            if (isBetter) {

                best = {
                    value: value,
                    station:
                        observation.station_name || ""
                };

            }
        }
    );

    return best;
}


// 各測站的觀測時間通常相同，取最新的一筆
// （頂部「最後更新」與右側統計卡的「觀測時間」共用這個來源）
function getLatestObservationTime(observationData) {

    return observationData.reduce(
        (latest, observation) => {

            const time =
                observation.observation_time || "";

            return time > latest
                ? time
                : latest;

        },
        ""
    );
}


// "2026-10-04T18:00:00+08:00" → "10/04 18:00"
// CWA 時間本來就是臺灣時間，直接取字串，不做時區換算
function formatObservationShortTime(value) {

    const match =
        /^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
            .exec(String(value || ""));

    return match
        ? `${match[1]}/${match[2]} ${match[3]}:${match[4]}`
        : "—";
}


// 把統計數值與測站名稱填進一格
function setObservationStat(
    valueId,
    extreme,
    formatValue
) {

    setOverviewText(
        valueId,
        extreme
            ? formatValue(extreme.value)
            : "—"
    );

    setOverviewText(
        `${valueId}-station`,
        extreme
            ? extreme.station
            : ""
    );
}


// readSource：這次資料是怎麼來的
//   "database"：頁面載入，直接讀資料庫
//   "api"     ：使用者按了「更新資料」，剛呼叫過 CWA API 並寫入資料庫
function renderObservationStats(
    observationData,
    readSource
) {

    const isApi =
        readSource === "api";

    // 沒有任何觀測資料：顯示提示，引導使用者按「更新資料」
    const emptyHint =
        document.getElementById(
            "obs-stats-empty"
        );

    if (emptyHint) {

        emptyHint.textContent =
            EMPTY_OBSERVATION_HINT;

        emptyHint.classList.toggle(
            "hidden",
            observationData.length > 0
        );

    }

    const badge =
        document.getElementById(
            "obs-stats-badge"
        );

    if (badge) {

        badge.textContent =
            isApi
                ? "即時 API"
                : "資料庫";

        badge.classList.toggle(
            "is-live",
            isApi
        );

    }

    setOverviewText(
        "obs-stats-read",
        isApi
            ? "即時呼叫 CWA API（已更新資料庫）"
            : "讀取資料庫"
    );

    setOverviewText(
        "obs-stats-count",
        `${observationData.length} 站`
    );

    setOverviewText(
        "obs-stats-time",
        formatObservationShortTime(
            getLatestObservationTime(
                observationData
            )
        )
    );

    // 氣溫低於 -50 視為缺值（-99）；
    // 雨量、風速為負數視為缺值（-99、-990）
    const isTemperature = value => value > -50;
    const isNonNegative = value => value >= 0;

    setObservationStat(
        "obs-max-temp",
        findObservationExtreme(
            observationData,
            "air_temperature",
            isTemperature,
            "max"
        ),
        value => `${value.toFixed(1)}°C`
    );

    setObservationStat(
        "obs-min-temp",
        findObservationExtreme(
            observationData,
            "air_temperature",
            isTemperature,
            "min"
        ),
        value => `${value.toFixed(1)}°C`
    );

    const maxRain =
        findObservationExtreme(
            observationData,
            "precipitation",
            isNonNegative,
            "max"
        );

    // 全台都沒下雨：不要顯示一個隨便挑出來的「最大雨量測站」
    setObservationStat(
        "obs-max-rain",
        maxRain && maxRain.value > 0
            ? maxRain
            : null,
        value => `${value.toFixed(1)}mm`
    );

    if (maxRain && maxRain.value === 0) {

        setOverviewText(
            "obs-max-rain",
            "無降雨"
        );

    }

    setObservationStat(
        "obs-max-wind",
        findObservationExtreme(
            observationData,
            "wind_speed",
            isNonNegative,
            "max"
        ),
        value => `${value.toFixed(1)}m/s`
    );
}


// ========================================
// 從 SQLite 重新載入畫面
// readSource：這次觀測資料的來源，見 renderObservationStats
// ========================================

async function renderWeatherMap(
    readSource = "database"
) {

    const locations =
        await loadLocations();


    const weatherData =
        await loadWeather();

    const observationData =
        await loadObservationWeather();

    renderObservationStats(
        observationData,
        readSource
    );


    console.log(
        "縣市資料：",
        locations
    );


    console.log(
        "天氣資料：",
        weatherData
    );

    console.log(
        "即時觀測資料：",
        observationData
    );


    console.log(
        `取得 ${locations.length} 個縣市`
    );


    console.log(
        `取得 ${weatherData.length} 筆天氣資料`
    );

    console.log(
        `取得 ${observationData.length} 筆即時觀測資料`
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
        weatherData,
        observationData
    );


    // --------------------------------
    // 更新時間
    // --------------------------------

    updateLastUpdateTime(observationData);


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

        // 剛呼叫過 CWA API，統計卡標示為「即時 API」
        await renderWeatherMap("api");

        // 非氣溫模式：重新套用目前圖層，
        // 避免縣市 Marker 蓋在風向 / 其他圖層上
        if (currentMapMode !== "temperature") {

            setMapMode(currentMapMode);

        }


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

        // 初始化地圖圖層控制器
        initializeMapLayerControls();


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