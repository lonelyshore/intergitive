# 開發說明  

`intergitive` 歡迎所有人參與貢獻  
最常見的貢獻方式有兩種：主程式修改以及教學內容修改  
不論您想要協助何種修改，這裡說明的開發環境建置還有建議的開發流程都可以幫助您快速熟悉上手  

## 建議的開發環境

以下是建議的開發環境配置， `intergitive` 大部分是使用這個配置開發的  
使用這個配置將能盡可能減少因環境差異而產生的問題  
後面的開發流程說明也將假設讀者的環境已經具備下列的工具

- Windows 10
- PowerShell v5.1
- node v12.20.2
- npm v6.14.11
- VS code v1.46
  - ESLint v2.1.8：專案使用 [JavaScript Standard](https://standardjs.com/) 的風格，單純因為專案後期引入 linter 的時候這種風格需要手動修改的程度最小
  - Vetur 0.24.0
  - vue 0.1.5
  - YAML 0.16.0

## 建議的開發流程

### 初始化專案

- 複製專案倉庫
- 開啟 PowerShell，切換目錄到複製下來的倉庫。後續步驟提及「執行指令」時若無特別說明，都假設在此目錄下使用 PowerShell 執行
- 安裝 npm 套件： 執行指令 `npm install`
- **重要**：安裝 `nodegit` (用來執行 git 的 npm 套件)。可以選擇執行預先寫好的指令檔自動安裝或手動安裝(如果不信任指令檔的內容)  
  - 透過指令檔自動安裝
    - 開通 PowerShell 執行指令檔的權限： 執行指令 `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process`  
    - 執行指令檔：執行指令 `.\post-npm-install-win.ps1 -architecture x64`
  - 手動安裝。我們將會為 node 以及 electron 兩種執行模式各自安裝一套 `nodegit`，並建立快取來快速切換這兩種模式
    - 初始化快取：執行 `node .\dev\module-switch.js init`
    - 丟棄既有快取(如果是第一次複製 `intergitive` 專案，可以跳過)：執行 `node .\dev\module-switch.js drop nodegit`
    - 為 electron 模式安裝 nodegit
      - 在專案目錄下建立 `.npmrc`，填入下列內容。如果已經存在 `.npmrc`，請以下列內容取代
    ```
    $content = @"
    runtime = electron
    target = 8.2.0
    target_arch = $architecture
    disturl = "https://atom.io/download/atom-shell"
    ```  
      - 透過 npm 安裝 nodegit：執行 `npm install nodegit@0.26.x`
      - 存入快取：執行 `node .\dev\module-switch.js save nodegit electron`
    - 為 node 模式安裝 nodegit
      - 刪除 `.npmrc`
      - 透過 npm 安裝 nodegit：執行 `npm install nodegit@0.26.x`  
      - 存入快取：執行 `node .\dev\module-switch.js save nodegit node` 

### 實驗是否初始化完成

- 在 node 模式執行測試：執行 `npm run test` (約需執行 5-10 分鐘)
- 在 electron 模式執行測試：執行 `npm run etest` (約需執行 5-10 分鐘)
- 測試運行程式：執行 `npm run test-pack`

### npm 指令

這裡概略說明 npm 可以執行的指令和使用情境
- `load-native-node`： 切換 npm 套件到 node 模式
- `load-native-electron`： 切換 npm 套件到 electron 模式
- `test`： 在 node 模式下執行測試。通常建議在修改主程式之後執行
- `check-course`： 在 node 模式下測試編寫的教學內容是否素材齊備。建議在修改教學內容後進行
- `etest`：在 electron 模式下執行測試。通常建議在修改主程式之後執行
- `lint`： 檢查是否符合程式慣例。建議在上傳修改前進行
- `fix-lint`：檢查是否符合程式慣例並盡可能自動修正。建議在上傳修改前進行
- `pack`： 以正式版(production)模式建置，建置出來的成品進入點是專案下的 `main.js`
- `pack-dev`：以開發版(development)模式建置，建置出來的成品進入點是專案下的 `main.js` 
- `test-pack`： 以開發版模式建置並執行專案
- `test-pack-production`： 以正式版模式建置並執行專案
- `build-pack-win64`： 以正式版模式建置，並且打包成最終成品到 `out` 資料夾 (執行前需要確定該資料夾沒有任何東西)  

### 上傳修改之前

- 請確定 lint 結果無異常：執行 `npm run lint` 或 `npm run fix-lint` 自動修正
- 請確定 test 結果無異常：執行 `npm run test`
