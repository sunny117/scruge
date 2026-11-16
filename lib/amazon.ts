import * as cheerio from "cheerio";
import { getPage } from "./fetch";
import { detectCategory, findModelNo, parseSpecs, type Product } from "./match";

const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?=[/?#]|$)/i;

/** Accepts full amazon.* links and amzn.in / amzn.to short links. Returns a clean /dp/ URL. */
export async function canonicalAmazonUrl(input: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new UserError("That doesn't look like a link.");
  }
  if (/^(www\.)?amzn\.(in|to|eu)$|^a\.co$/.test(u.hostname)) {
    const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const loc = r.headers.get("location");
    if (!loc) throw new UserError("Couldn't expand that short Amazon link.");
    u = new URL(loc, u);
  }
  if (!/(^|\.)amazon\.[a-z.]+$/.test(u.hostname)) throw new UserError("Please paste an Amazon product link.");
  const asin = u.pathname.match(ASIN_RE)?.[1];
  if (!asin) throw new UserError("That Amazon link has no product ID (ASIN) in it.");
  return `https://${u.hostname.replace(/^(?!www\.)/, "www.")}/dp/${asin.toUpperCase()}`;
}

export class UserError extends Error {}

/** "₹94,999.00" / "94,999." → 94999; anything unparseable → undefined. */
export function rupees(s?: string): number | undefined {
  const n = parseFloat((s ?? "").replace(/[^\d.]/g, "").replace(/\.$/, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

const clean = (s: string) => s.replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim();

export async function readAmazon(url: string): Promise<Product & { url: string; image?: string }> {
  const $ = cheerio.load(await getPage(url, "productTitle"));
  const title = clean($("#productTitle").text());
  if (!title) throw new Error("Amazon page had no product title");

  // key/value rows from the "overview" box and the tech-spec tables
  const spec: Record<string, string> = {};
  $("#productOverview_feature_div tr").each((_, r) => {
    spec[clean($(r).find("td").eq(0).text()).toLowerCase()] = clean($(r).find("td").eq(1).text());
  });
  // every "product details" table on the page uses these two classes, whatever its id
  $("th.prodDetSectionEntry").each((_, th) => {
    const k = clean($(th).text()).toLowerCase();
    if (k && !spec[k]) spec[k] = clean($(th).siblings("td").first().text());
  });
  $("#detailBullets_feature_div li").each((_, li) => {
    const [k, ...v] = clean($(li).text()).split(":");
    if (v.length && !spec[k.trim().toLowerCase()]) spec[k.trim().toLowerCase()] = v.join(":").trim();
  });

  const byline = clean($("#bylineInfo").text())
    .replace(/^visit the\s+/i, "")
    .replace(/\s+store$/i, "")
    .replace(/^brand:\s*/i, "");
  const brand = spec["brand"] || spec["brand name"] || byline || title.split(" ")[0];

  const colour =
    spec["colour"] || spec["color"] || clean($("#variation_color_name .selection").text()) || clean($("#inline-twister-expanded-dimension-text-color_name").text()) || undefined;

  // Spec text: title plus structured rows (rows win because titles sometimes omit RAM)
  const ramRow = spec["ram memory installed size"] || spec["ram"] || spec["ram size"];
  const specText = [
    title,
    ramRow && `${ramRow} RAM`,
    spec["memory storage capacity"] || spec["storage"] || spec["rom"],
    spec["screen size"] || spec["standing screen display size"],
    spec["capacity"],
    spec["wattage"],
  ]
    .filter(Boolean)
    .join(" , ");
  const { ram, storage, screen } = parseSpecs(specText);

  const crumbs = clean($("#wayfinding-breadcrumbs_feature_div").text());
  const category = detectCategory(specText, `${crumbs} ${spec["generic name"] ?? ""} ${$("#nav-subnav").attr("data-category") ?? ""}`);

  return {
    url,
    title,
    brand: brand.trim(),
    category,
    ram: category === "phone" ? ram : undefined,
    storage: category === "phone" ? storage : undefined,
    screen: category === "tv" ? screen : undefined,
    // general category: only a stated colour counts (a guessed one would wrongly reject matches)
    colour: category === "other" ? colour : colour || title.split(/\s[-–]\s/).pop(),
    modelNo:
      category === "tv" || category === "other"
        ? findModelNo(spec["model number"] || spec["item model number"] || spec["model"] || "", 5) ??
          // a title segment that is just one code, e.g. "… | Game Master | 55T6D"
          title.split("|").map((s) => s.trim()).filter((s) => !/\s/.test(s)).map((s) => findModelNo(s, 5)).find(Boolean) ??
          findModelNo(title)
        : undefined,
    specText,
    image: $("#landingImage").attr("src"),
    // only the buy-box price; the rest of the page lists prices of other products
    price: rupees(
      $("#corePriceDisplay_desktop_feature_div .a-price-whole").first().text() ||
        $("#corePrice_feature_div .a-offscreen").first().text() ||
        $("#apex_desktop .priceToPay .a-price-whole").first().text(),
    ),
  };
}
