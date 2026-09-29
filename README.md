AIoT 課程 — L3 — CWA HW1 專案說明文件

# 🌤️ 台灣天氣地圖

一個基於 **中央氣象署（CWA）Open Data** 開放資料所開發的台灣天氣資訊網站。

本專案透過 **Flask + SQLite + Leaflet + OpenStreetMap** 建立完整的天氣資料流程，將中央氣象署提供的天氣資料取得、解析、儲存至 SQLite 資料庫，再透過後端 API 提供前端地圖與天氣資訊使用。

使用者可以透過台灣地圖查看各縣市與鄉鎮的天氣資訊，並透過「全台天氣概覽」查看指定縣市未來一週的天氣與溫度變化。

---

## 🌐 線上展示

**Demo：**

學生 Live Demo Page: https://l3-ai-vibe-coding-hw-1.vercel.app/

**GitHub：**

學生儲存庫網址: https://github.com/PecoRun/L3-AI-vibe-coding-HW1

---

![alt text](image.png)

## 📌 專案功能

### 🗺️ 台灣天氣地圖

使用 Leaflet 搭配 OpenStreetMap 建立台灣地圖。

* 顯示台灣各縣市位置
* 顯示縣市天氣標記
* 點擊縣市查看詳細天氣
* 支援進一步查看鄉鎮天氣
* 地圖操作支援縮放與拖曳

### 🌤️ 縣市天氣資訊

點擊地圖上的縣市後，右側面板顯示目前天氣資訊：

* 天氣狀況
* 目前溫度
* 最低溫
* 最高溫
* 降雨機率
* 舒適度

### 🏘️ 鄉鎮天氣資訊

選擇縣市後，可以查看該縣市的鄉鎮天氣資訊。

提供：

* 鄉鎮名稱
* 天氣狀況
* 最高溫
* 最低溫
* 降雨機率
* 天氣圖示

### 📊 全台天氣概覽

地圖左側提供「全台天氣概覽」功能。

使用者可以選擇縣市，查看：

* 未來一週天氣
* 最高溫
* 最低溫
* 降雨機率
* 一週溫度折線圖

### 🔄 更新天氣資料

網站提供「更新資料」功能。

使用者按下更新按鈕後：

1. 呼叫 Flask 後端 API
2. 取得中央氣象署最新資料
3. 解析與整理 JSON
4. 更新 SQLite 資料庫
5. 前端重新讀取資料
6. 顯示最新天氣資訊

---

# 🏗️ 系統架構

本專案採用以下資料流程：


中央氣象署 CWA Open Data
          │
          ▼
       REST API
          │
          ▼
     JSON 天氣資料
          │
          ▼
   資料解析 / 清理 / 轉換
          │
          ▼
        SQLite
          │
          ▼
    Flask Backend API
          │
          ▼
  Leaflet + OpenStreetMap
          │
          ▼
      Web Frontend
          │
          ▼
        Vercel


本專案的主要資料流為：


CWA Open Data
      ↓
Python / Requests
      ↓
Flask Backend
      ↓
資料解析與轉換
      ↓
SQLite Database
      ↓
REST API
      ↓
JavaScript
      ↓
Leaflet / Chart.js
      ↓
使用者介面


---

# 🛠️ 使用技術

| 類別                    | 技術                                       |
| --------------------- | ---------------------------------------- |
| Backend               | Python                                   |
| Web Framework         | Flask                                    |
| Database              | SQLite                                   |
| HTTP Client           | Requests                                 |
| Frontend              | HTML / CSS / JavaScript                  |
| Map                   | Leaflet                                  |
| Map Data              | OpenStreetMap                            |
| Chart                 | Chart.js                                 |

---

# 🌦️ 資料來源

本專案使用：

**中央氣象署（Central Weather Administration, CWA）政府開放資料**

資料來源：

https://opendata.cwa.gov.tw/

主要使用的資料集包含：

### 3 天預報


F-C0032-001


用於取得縣市層級的天氣預報資料。

包含：

* 天氣現象
* 降雨機率
* 最低溫
* 最高溫
* 舒適度
* 預報時間

### 未來一週天氣


F-D0047-091


用於「全台天氣概覽」功能。

包含：

* 縣市
* 經緯度
* 平均溫度
* 最高溫
* 最低溫
* 天氣現象
* 降雨機率

### 鄉鎮天氣


F-D0047-093


用於取得各縣市鄉鎮層級的天氣資料。

---

# 🔄 更新天氣資料

網站啟動後，預設從 SQLite 讀取已儲存的資料。

若需要取得最新資料，可以點擊：


更新資料


系統會呼叫：

http
POST /api/weather/refresh


取得中央氣象署最新資料並更新 SQLite。

資料流程：


使用者按下「更新資料」
            ↓
POST /api/weather/refresh
            ↓
取得 CWA Open Data
            ↓
資料解析
            ↓
資料清理與轉換
            ↓
SQLite
            ↓
前端重新取得資料
            ↓
更新地圖與天氣資訊

---