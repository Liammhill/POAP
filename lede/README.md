# Lede

A private, installable business companion for **Eleanor Herzog — communications strategist & consultant**.
Runs on phone and desktop as a Progressive Web App; all business data is encrypted on the device with her password.

## What's inside

| Area | What it does |
| --- | --- |
| **Today** | Greeting dashboard: money received this tax year, unpaid invoices, weighted pipeline, monthly tax set-aside; a "worth your attention" list (invoices to chase, deals going cold, clients due a catch-up) and upcoming HMRC dates. |
| **Money & tax** | Invoices (paid / unpaid / overdue, one-tap "mark paid", pre-written chaser email, printable PDF invoice, CSV export for the accountant), expenses with a mileage helper, analytics by month, **MTD quarter** and **UK tax year**, and a **tax planner**: band, income tax + Class 4 NI estimate, how much to set aside per month / per payment, "on track" check against the tax pot, VAT threshold watch, Making Tax Digital status, payments-on-account notes. |
| **Pipeline** | Kanban of unconfirmed work (client, value, likelihood, weighted value). Deals are marked **cooling** after N quiet days and **stale** at 2N, or once the expected start date has passed. |
| **Clients** | Register with a value score (last-12-month and lifetime invoicing, recency, frequency) → tiers *Key / Valued / Occasional / Dormant*, catch-up reminders scaled by value, average days-to-pay, and a concentration-risk warning when one client is >40% of income. |
| **Opportunity scout** | A daily scan of public UK procurement notices (Contracts Finder, Find a Tender) and job-board RSS feeds, scored against her keywords with a not-for-profit / public-sector boost. One tap adds a lead to the pipeline. Quick-search links cover boards with no feed (CharityJob, CharityComms, Guardian Jobs, LinkedIn, Escape the City…). |
| **Pitch studio** | Ranks recent invoiced work by profile (★), showcase flag, value and recency. Builds a **CV** or **credentials sheet** from the best recent highlights (optionally tailored to charity & public sector) → print/PDF or copy as text. Stores CVs and decks, and nudges when the CV is older than the latest standout work. |
| **Settings** | Business details for invoices, tax parameters (editable for future years), scout keywords, auto-lock, password change, encrypted backup download, Google Drive. |

## Privacy model

* On first launch Eleanor chooses a password. A key is derived from it (PBKDF2-SHA256, 600k iterations) and **everything** — invoices, clients, documents — is stored only as AES-256-GCM ciphertext in the browser's IndexedDB.
* There is no server and no account. Without the password the data can't be read; **there is also no password reset**, so keep it in a password manager and turn on Drive sync or download backups.
* The app auto-locks after 10 idle minutes (configurable).
* The optional Google Drive sync uploads only the encrypted file, into Drive's hidden *app data* folder.
* The source code and the public opportunity feed are public; the business data never is.

## Deploying (one-off)

1. Merge this branch into `main`.
2. GitHub repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The *Lede — build, scan & deploy* workflow publishes to `https://liammhill.github.io/poap/` and re-runs daily to refresh opportunities (or run it manually from the Actions tab).

### Installing on her devices
* **iPhone/iPad (Safari):** open the URL → Share → *Add to Home Screen*.
* **Android (Chrome):** menu → *Install app*.
* **Mac/Windows (Chrome or Edge):** install icon in the address bar. (Safari on macOS: File → *Add to Dock*.)

Each device has its own encrypted copy. To use more than one device, turn on Drive sync on the first, then on the next device choose *"Already use Lede on another device?"*.

## Connecting Google Drive (one-off, ~10 minutes)

Needed to import historic records from Drive and to sync between devices.

1. Go to <https://console.cloud.google.com/> → create a project (e.g. "Lede").
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen** → *External* → app name "Lede" → add Eleanor's Google address as a **test user**. (Staying in "Testing" mode is fine for personal use.)
4. **Credentials → Create credentials → OAuth client ID** → *Web application* → Authorised JavaScript origins: `https://liammhill.github.io` (add `http://localhost:5173` for local development).
5. Copy the client ID into Lede → **Settings → Google Drive** and press **Connect**.

Scopes requested: `drive.readonly` (to search and read her spreadsheets — Lede never edits her files) and `drive.appdata` (the hidden folder for the encrypted backup).

## Importing from Starling

Eleanor banks and files her tax return through Starling, and writes her own invoices. **Money & tax → Starling statement** takes Starling's CSV transaction export:

* **Money in** is grouped by payer and matched to clients (truncated bank names like `RIVERSIDE HOUSING TRUS` are matched automatically). Interest, refunds, HMRC and transfers from herself are left out by default.
* **Money out** becomes expenses, with a category guessed from Starling's spending category; tax payments and transfers to herself are excluded.
* A payment whose reference quotes a Lede invoice number, or that matches an unpaid invoice's client and amount, marks that invoice paid, so Lede always knows what's still outstanding.
* Choices are remembered per payee, and transactions already imported are skipped, so a monthly export with overlapping dates is one click.

With "Tax returns are filed through Starling" on (Settings, default), the Making Tax Digital card becomes a reference panel.

## Importing historic records

**Money & tax → Import** accepts Google Sheets (all tabs), Excel and CSV — from Drive or an upload. Lede detects the header row and guesses columns (client, invoice no., date, amount, paid date / status), shows a summary (row count, total, date range, number of clients) and a preview, then imports. Clients are created automatically and duplicates are skipped, so re-importing an updated sheet is safe. Expenses can be imported the same way.

## Opportunity scanner

`scanner/scan.mjs` (no dependencies) runs in GitHub Actions and writes `opportunities.json` next to the app. Edit `scanner/config.json` to change the look-back window, keyword filter, CPV codes and RSS feeds. In-app scoring uses the keywords in Settings, so tuning relevance doesn't need a redeploy. Sources that fail are skipped and reported in the app.

## Developing

```bash
cd lede
npm install
npm run dev        # http://localhost:5173
npm test           # tax engine checks
npm run scan       # refresh public/opportunities.json locally
npm run build
```

Choose *"Start with sample data"* on the first screen to explore with fictional clients.

## Notes & limits

* Tax figures are estimates using 2026/27 rates for England, Wales & NI (Scottish income tax bands differ — edit them in Settings if needed). Not a substitute for an accountant.
* Uploaded documents are capped at 8 MB each, since they live inside the encrypted vault.
* RSS feed URLs for job boards change from time to time; if a source shows ✕ in the scout, update `scanner/config.json`.
