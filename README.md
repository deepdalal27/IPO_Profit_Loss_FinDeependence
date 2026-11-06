# IPO Deal Desk · FinDeependence

**Created by CA Deep Dalal** · Open the app: **https://deepdalal27.github.io/IPO_Profit_Loss_FinDeependence/**

A web app for running an IPO application desk: you pay investors for their Retail / sHNI / bHNI applications (Kostak, Subject-to or premium per share), hold the risk or sell it on to brokers, and settle after listing. It works out what each investor owes or is owed, what each broker owes or is owed, and your net profit. It also shows how the business is growing.

## The three deal patterns

| Scenario | How to book it | Result |
|---|---|---|
| 1. Pay Yash ₹300 (Kostak), keep the listing P/L | Investor deal **Kostak ₹300**, broker: *keep the risk* | Allotted & normal gain ₹1,000 → Yash pays you **₹700**. Not allotted → you pay **₹300** |
| 2. Pay Yash ₹300, sell the application to a broker for ₹400 | Investor **Kostak ₹300**, broker **Kostak ₹400** | Gain ₹1,000 → receive ₹700 from Yash, pay ₹600 to broker → **₹100 profit**, whatever happens |
| 3. Pay Yash ₹300, after allotment sell the shares at GMP ₹10/share | Investor **Kostak ₹300**; after allotment, *Sell to broker…* **Premium ₹10/share** | Lists +₹1,500 → pay broker ₹500; lists +₹800 → broker pays ₹200 → **₹700 profit** either way |

Also supported: **Subject-to** (pay only if allotted) on either side, and **Own account** (no payout).

Formulas: Investor ± = listing P/L (if allotted) − investor deal amount. Broker ± = broker deal amount − listing P/L (if allotted). My profit = Investor ± + Broker ±.

## Tabs

- **Dashboard:** realised and expected profit, broker receivables, investor payables, allotment rate vs the SEBI odds, how much of the book is hedged. Charts: monthly profit and volume, profit by IPO, category × strategy, top investors, brokers, GMP vs actual listing. Also shows insights, open positions with the flat-listing downside, and a live opportunity board.
- **IPOs & GMP:** each IPO's GMP, subscription, application counts and **SEBI allotment odds** for Retail, sHNI and bHNI. It gives the gain if allotted, the expected value per application (= fair Kostak), the fair Subject-to rate and your bid rates after your margin. Before subscription data is out, type an assumed subscription to see the odds.
- **Deals:** tick any number of investors and add them in one go, with category, investor deal and an optional broker deal. Record results with Yes/No, or paste the allotted PANs. Enter the settlement price, sell to brokers in bulk and mark rows settled. **Msg** copies a ready WhatsApp message for an investor or broker. Download the IPO settlement sheet as Excel or PDF.
- **Reports:** monthly, IPO-wise, investor ledger with statement, broker ledger, category, and all deals. Filter by period, IPO, investor, broker, category or status. Download as Excel (full workbook) or PDF.
- **Investors & Brokers:** add one at a time, or bulk-add by pasting from Excel or WhatsApp or uploading CSV / Excel. PANs are checked and duplicates blocked. Edit in place, set groups, mark inactive, or bulk-delete.
- **Data & Settings:** the IPO Premium update button, page import, backup / restore, bid margin, probability factors, theme and demo data.

## SEBI allotment odds

- **Retail:** when oversubscribed, each winner gets the minimum lot by lottery. Chance = (retail shares ÷ lot) ÷ applications.
- **sHNI (₹2–10 L, ⅓ of NII) and bHNI (> ₹10 L, ⅔ of NII):** each winner gets the *minimum NII application* (the smallest number of lots above ₹2 L) by lottery, and any balance is allotted proportionately. Chance = (category shares ÷ NII minimum) ÷ applications.
- **SME:** the individual minimum is 2 lots.
- When application counts are published (IPO Premium's application-wise data), they are used directly. Otherwise applications are estimated from the times subscribed, using factors calibrated on recent IPOs (Retail 1.3, sHNI 1.05, bHNI 5). You can change these factors in Settings.

## Keeping IPO data fresh

1. **Automatic:** `.github/workflows/pages.yml` runs every 30 minutes during market hours. It merges NSE's IPO API (dates, price, lot, category-wise subscription), ipopremium.in (GMP, subscription, application counts, listing price) and investorgain.com (GMP) into `site/ipos.json`, then redeploys the site. Pages that show a bot check are skipped, never bypassed.
2. **One click from your browser:** in *Data & Settings*, drag **"⟳ FinDeependence · Update IPOs"** to your bookmarks bar. Open ipopremium.in and click it. It reads every recent IPO page and opens the desk with fresh GMP and subscription data.
3. Or import saved IPO Premium pages (.html), or edit any IPO by hand.

## Your data

Investors, PANs and deals are stored **only in your browser** (localStorage). They are never uploaded to GitHub. Use **Download backup** regularly, and **Restore backup** on another device.

## Development

```bash
npm ci
```

```bash
npm test
```

```bash
npm start
```

`npm start` serves `site/` at http://localhost:3000. To merge saved IPO Premium pages into `site/ipos.json`, run `node scripts/sync.js page1.html page2.html`.
