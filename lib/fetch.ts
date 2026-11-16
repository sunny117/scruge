// One door for every outbound request: try direct first, fall back to ScraperAPI when blocked.

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "accept-language": "en-IN,en;q=0.9",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

export class NotFoundError extends Error {}

async function direct(url: string): Promise<{ status: number; body: string }> {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  return { status: r.status, body: await r.text() };
}

async function viaProxy(url: string): Promise<{ status: number; body: string }> {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) throw new Error("blocked and SCRAPER_API_KEY is not set");
  const u = `https://api.scraperapi.com/?api_key=${key}&country_code=in&url=${encodeURIComponent(url)}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
  return { status: r.status, body: await r.text() };
}

/**
 * Fetch a page. `mustContain` is a marker that a real (non-captcha) page always has;
 * if it is missing we assume a bot wall and retry through the proxy.
 */
export async function getPage(url: string, mustContain: string): Promise<string> {
  let res: { status: number; body: string } | null = null;
  try {
    res = await direct(url);
  } catch {
    // network error / timeout → try proxy
  }
  if (res?.status === 404) throw new NotFoundError(url);
  if (res && res.status < 400 && res.body.includes(mustContain)) return res.body;

  res = await viaProxy(url);
  if (res.status === 404) throw new NotFoundError(url);
  if (res.status < 400 && res.body.includes(mustContain)) return res.body;
  throw new Error(`could not fetch ${new URL(url).hostname} (status ${res.status})`);
}
