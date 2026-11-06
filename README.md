# IPO Deal Desk · FinDeependence

**Created by CA Deep Dalal** · Open the app: **https://deepdalal27.github.io/IPO_Profit_Loss_FinDeependence/**

Track IPO applications taken from investors (Retail / sHNI / bHNI) and the deals you make with brokers. The app shows what you will receive, what you will pay and your profit for each IPO, investor and broker, by month and by category.

| Tab | What it does |
|---|---|
| Dashboard | Profit, receivables, payables, monthly growth and charts |
| IPOs & GMP | Live IPOs, GMP, subscription, SEBI chance of allotment, fair rates |
| Deals | One row per investor: pick the category, the deal and the broker, then record the allotment and settle up |
| Calculator | Enter any deal and see what you receive / pay and your profit |
| Reports | Monthly, IPO-wise, investor and broker ledgers, with Excel and PDF |
| Investors & Brokers | Add or delete one at a time or in bulk (name + PAN) |
| Data & Settings | IPO Premium update button, backup / restore, settings |

Investor names, PANs and deals are saved only in your browser. Download a backup from **Data & Settings**.

IPO data (`site/ipos.json`) refreshes every 30 minutes from NSE, ipopremium.in and investorgain.com (`.github/workflows/pages.yml`).

Development: `npm ci`, then `npm test`, then `npm start`.
