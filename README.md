# Same Product Finder

Paste any Amazon product link and see whether Flipkart, Croma and Myntra sell the same product: **In stock**, **Out of stock**, or **Not listed**.

Smartphones, TVs, sneakers and T-shirts/polos/jerseys get the assignment's strict rules (RAM + storage, screen size, colour). Any other product gets a **general match**: brand + model name + model number + every measurement both listings mention (litres, watts, GB, pack of N…), and all three platforms are searched.

How the matching works, in plain words: [HOW_IT_WORKS.md](HOW_IT_WORKS.md)

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # matching rules
```

## Deploy to Vercel

1. Push this folder to GitHub and import it in Vercel. No settings to change.
2. Optional, only if a site blocks Vercel's servers: create a free key at scraperapi.com and add it as the env var `SCRAPER_API_KEY`. Every request tries a direct fetch first and uses the proxy only when it detects a bot wall. On Vercel, Amazon blocks direct requests almost always, so set the key for any deployed demo. Optional: `SCRAPER_COUNTRY=in` routes through Indian IPs, which may need a paid ScraperAPI plan.

## Code map

| File | What it does |
|---|---|
| `lib/amazon.ts` | Reads the Amazon page: title, brand, category, RAM/storage, screen, colour, model number |
| `lib/platforms.ts` | Searches Flipkart / Croma / Myntra, retries with other phrasings, checks stock |
| `lib/match.ts` | The matching rules (pure functions, no network) |
| `lib/fetch.ts` | Direct fetch, with ScraperAPI fallback when blocked |
| `app/api/match/route.ts` | `GET /api/match?url=…` returns JSON |
| `app/page.tsx` | The single page UI |

API example: `/api/match?url=https://www.amazon.in/dp/B0F6ZLFNVT`
