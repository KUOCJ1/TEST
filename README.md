# AI 全方位職能實戰課前評測系統

線上問卷評測 + 自動計分 + 落點分析，含**帳號登入**、**個人能力分析**與**管理後台儀表板**。

- **前端**：React + Vite + Tailwind，手刻 SVG 圖表（雷達圖、趨勢折線、長條、分佈），零第三方圖表相依。
- **後端**：Node + Express，JWT（httpOnly cookie）認證、bcrypt 密碼雜湊、檔案型 JSON 儲存（純 JS、無原生相依、易備份）。

## 功能
- 6 大構面、31 題李克特量表，送出後自動計分與四級落點分析。
- 使用者：註冊／登入、作答、查看個人落點報告、歷次總分趨勢與作答紀錄。
- 管理員：整體 KPI、平均構面雷達圖、各構面達成率、落點等級分佈、填答者明細。

## 開發
```bash
npm install
npm run dev            # 前端 (http://localhost:5173)，/api 會 proxy 到 :3001

# 另開一個終端機啟動後端
cd server
npm install
cp .env.example .env   # 填入 JWT_SECRET 等
node --env-file=.env src/server.js
```

## 測試與建置
```bash
npm run lint           # 前端 ESLint
npm test               # 前端 Vitest（元件與流程）
npm run build          # 前端 production 打包

cd server && npm test  # 後端 API 測試（node --test + supertest）
```

## 部署（VPS：Ubuntu + Nginx + HTTPS）
完整步驟見 **[DEPLOYMENT.md](./DEPLOYMENT.md)**。更新版本時於專案根目錄執行：
```bash
git pull && bash deploy/deploy.sh
```

> 資料以 `/var/lib/ai-assessment/db.json` 單檔保存，適合課程／中小規模；
> 需更高併發或多機時，建議改接 PostgreSQL 等資料庫。
