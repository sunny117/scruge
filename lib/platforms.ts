import { getPage } from "./fetch";
import { findModelNo, isSameProduct, modelTokens, parseSpecs, pickBest, type Candidate, type Category, type Product } from "./match";

export type Platform = "Flipkart" | "Croma" | "Myntra";
export const PLATFORMS: Record<Category, Platform[]> = {
  phone: ["Flipkart", "Croma"],
  tv: ["Flipkart", "Croma"],
  shoes: ["Flipkart", "Myntra"],
  tshirt: ["Flipkart", "Myntra"],
  other: ["Flipkart", "Croma", "Myntra"], // unknown category: ask everyone, "Not listed" is cheap
};

export type Result =
  | { platform: Platform; status: "in_stock" | "out_of_stock"; url: string; title: string; why: string; price?: number }
  | { platform: Platform; status: "not_listed"; closest?: { title: string; url: string; why: string }; queries: string[] }
  | { platform: Platform; status: "error"; error: string };

// ---------- per-platform search → Candidate[] ----------

function withSpecs(c: Omit<Candidate, "ram" | "storage" | "screen" | "specText">, specText: string): Candidate {
  return { ...c, ...parseSpecs(specText), specText };
}

async function searchFlipkart(q: string): Promise<Candidate[]> {
  const html = await getPage(`https://www.flipkart.com/search?q=${encodeURIComponent(q)}`, "__INITIAL_STATE__");
  const s = html.slice(html.indexOf("window.__INITIAL_STATE__"));
  const state = JSON.parse(s.slice(s.indexOf("{"), s.indexOf("</script>")).trim().replace(/;\s*$/, ""));
  const found: any[] = [];
  (function walk(o: any, d: number) {
    if (!o || typeof o !== "object" || d > 40) return;
    if (o.productInfo?.value?.titles) found.push(o.productInfo.value);
    for (const k in o) walk(o[k], d + 1);
  })(state, 0);

  const seen = new Set<string>();
  return found.flatMap((v) => {
    const path = String(v.baseUrl ?? "").split("?")[0];
    if (!path || seen.has(path)) return []; // same listing shows once per size
    seen.add(path);
    const t = v.titles;
    const keySpecs: string[] = v.keySpecs ?? [];
    const display = v.availability?.displayState as string | undefined;
    const modelId = keySpecs.find((k) => /^Model ID:/i.test(k))?.replace(/^Model ID:\s*/i, "");
    return [
      withSpecs(
        {
          title: t.title,
          brand: t.superTitle,
          url: `https://www.flipkart.com${v.baseUrl}`,
          // fashion: subtitle is "Black , 7"; phones: colour sits in the title parens
          colour: t.subtitle && !/ram|^[A-Z0-9]{8,}$/i.test(t.subtitle) ? t.subtitle.split(",")[0].trim() : t.title,
          modelNo: modelId ? findModelNo(modelId, 5) : findModelNo(t.subtitle ?? ""),
          inStock: display === undefined ? undefined : display === "IN_STOCK",
          price: v.pricing?.finalPrice?.value ?? v.pricing?.prices?.find((x: any) => !x.strikeOff)?.value,
        },
        [t.title, t.subtitle, ...keySpecs].join(" , "),
      ),
    ];
  });
}

async function flipkartInStock(url: string): Promise<boolean> {
  const html = await getPage(url, "application/ld+json");
  return /schema\.org\/InStock/.test(html) && !/schema\.org\/(OutOfStock|SoldOut|Discontinued)/.test(html);
}

async function searchCroma(q: string): Promise<Candidate[]> {
  const u = `https://api.croma.com/searchservices/v1/search?currentPage=0&query=${encodeURIComponent(q + ":relevance")}&fields=FULL&channel=WEB&channelCode=400049&spellOpt=DEFAULT`;
  const json = JSON.parse(await getPage(u, '"products"'));
  return (json.products ?? []).map((p: any) =>
    withSpecs(
      {
        title: p.name,
        brand: p.manufacturer,
        url: `https://www.croma.com${p.url}`,
        colour: p.name,
        // Croma's search returns out-of-stock items too; stockFlag lists stores holding stock
        inStock: Array.isArray(p.stockFlag) && p.stockFlag.length > 0,
        price: p.price?.value,
      },
      `${p.name} , ${p.summary ?? ""}`,
    ),
  );
}

function myx(html: string): any {
  const m = html.match(/window\.__myx\s*=\s*(\{[\s\S]*?\})<\/script>/);
  if (!m) throw new Error("Myntra page format changed");
  return JSON.parse(m[1]);
}

async function searchMyntra(q: string): Promise<Candidate[]> {
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const data = myx(await getPage(`https://www.myntra.com/${slug}`, "__myx"));
  return (data.searchData?.results?.products ?? []).map((p: any) => ({
    title: p.productName,
    brand: p.brand,
    url: `https://www.myntra.com/${p.landingPageUrl}`,
    colour: p.primaryColour,
    price: p.price,
    inStock: undefined,
  }));
}

async function myntraInStock(url: string): Promise<boolean> {
  const d = myx(await getPage(url, "__myx"));
  const p = d.pdpData;
  if (p?.flags?.outOfStock) return false;
  return (p?.sizes ?? []).some((s: any) => s.available) || p?.flags?.outOfStock === false;
}

const SEARCH: Record<Platform, (q: string) => Promise<Candidate[]>> = { Flipkart: searchFlipkart, Croma: searchCroma, Myntra: searchMyntra };
const STOCK: Partial<Record<Platform, (url: string) => Promise<boolean>>> = { Flipkart: flipkartInStock, Myntra: myntraInStock };

// ---------- queries: try a few phrasings, stop at the first that yields a match ----------

const CAT_WORD: Record<Category, string> = { phone: "mobile", tv: "tv", shoes: "shoes", tshirt: "t-shirt", other: "" };

export function queriesFor(p: Product): string[] {
  const tokens = modelTokens(p.title, p.brand);
  const base = [p.brand, ...tokens.slice(0, 6)].join(" ");
  const qs = [
    p.category === "tv" && p.modelNo ? `${p.brand} ${p.modelNo}` : "",
    // general category: Amazon titles are long keyword lists, so also try just brand + model name (+ product noun)
    p.category === "other" ? [p.brand, ...new Set([...tokens.slice(0, 2), tokens.at(-1) ?? ""])].join(" ") : "",
    p.category === "tv" && p.screen ? `${base} ${p.screen} inch tv` : "",
    p.category === "phone" && p.storage ? `${base} ${p.storage} gb` : "", // otherwise the 128GB variant crowds out 256GB
    `${base} ${CAT_WORD[p.category]}`, // Myntra needs a category word or it ignores numbers
    base,
  ];
  return [...new Set(qs.filter(Boolean).map((q) => q.replace(/\s+/g, " ").trim().toLowerCase()))].slice(0, 3);
}

async function finish(platform: Platform, p: Product, best: Candidate): Promise<Result> {
  const inStock = best.inStock ?? (await STOCK[platform]!(best.url));
  return { platform, status: inStock ? "in_stock" : "out_of_stock", url: best.url, title: best.title, why: isSameProduct(p, best).why, price: best.price };
}

export async function findOn(platform: Platform, p: Product): Promise<Result> {
  const queries = queriesFor(p);
  let closest: { title: string; url: string; why: string } | undefined;
  let fallback: Candidate | undefined; // a word-based match, held while we look for an exact model-number match
  const byModelNo = (c: Candidate) => isSameProduct(p, c).why.includes("model number");
  try {
    for (const q of queries) {
      const cands = await SEARCH[platform](q);
      const matches = cands.filter((c) => {
        const v = isSameProduct(p, c);
        // remember the most useful near-miss: same model but wrong spec beats a different model
        const specMiss = /^(storage|RAM|screen|colour|spec)/.test(v.why);
        if (!v.ok && !v.why.startsWith("brand") && (!closest || (specMiss && !/^(storage|RAM|screen|colour|spec)/.test(closest.why))))
          closest = { title: c.title, url: c.url, why: v.why };
        return v.ok;
      });
      // an exact model-number match beats any word-based match ("Karishma" pink dial vs the exact 2598YM01)
      const exact = matches.find(byModelNo);
      if (exact) return await finish(platform, p, exact);
      fallback ??= pickBest(p, matches);
      if (fallback && !p.modelNo) break; // no model number to hold out for
    }
    if (fallback) return await finish(platform, p, fallback);
    return { platform, status: "not_listed", closest, queries };
  } catch (e) {
    return { platform, status: "error", error: (e as Error).message };
  }
}
