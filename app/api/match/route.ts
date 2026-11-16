import { NextResponse } from "next/server";
import { canonicalAmazonUrl, readAmazon, UserError } from "@/lib/amazon";
import { NotFoundError } from "@/lib/fetch";
import { findOn, PLATFORMS } from "@/lib/platforms";

export const maxDuration = 120; // proxied fetches take 3–10 s each; fits Vercel Hobby with Fluid compute (max 300 s)

// ponytail: per-instance memory cache; swap for Vercel KV / Redis if hit rate matters
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 30 * 60_000;

export async function GET(req: Request) {
  const input = new URL(req.url).searchParams.get("url") ?? "";
  try {
    const url = await canonicalAmazonUrl(input);
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

    const product = await readAmazon(url);
    const results = await Promise.all(PLATFORMS[product.category].map((p) => findOn(p, product)));
    const body = { product, results };
    // don't cache transient failures
    if (!results.some((r) => r.status === "error")) cache.set(url, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Amazon says that product page doesn't exist." }, { status: 404 });
    return NextResponse.json({ error: `Something went wrong: ${(e as Error).message}` }, { status: 502 });
  }
}
