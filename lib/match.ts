// Pure matching logic — no network. Everything here is covered by match.test.ts.

/** The four assignment categories get strict rules; "other" = anything else, matched generally. */
export type Category = "phone" | "tv" | "shoes" | "tshirt" | "other";

export interface Product {
  title: string;
  brand: string;
  category: Category;
  ram?: number; // GB
  storage?: number; // GB
  screen?: number; // inches
  colour?: string;
  modelNo?: string;
  specText?: string; // title + spec rows, read for general-category measures
  price?: number; // ₹, what you'd pay now
}

export interface Candidate {
  title: string;
  brand?: string;
  url: string;
  colour?: string;
  ram?: number;
  storage?: number;
  screen?: number;
  modelNo?: string;
  specText?: string;
  price?: number; // ₹
  inStock?: boolean; // undefined = need to open the product page to know
}

/** Lowercase + fold fancy unicode (‑ – ’ etc.) that Amazon titles are full of. */
const low = (s: string) =>
  s.normalize("NFKC").replace(/[‐-―−]/g, "-").replace(/[‘’′]/g, "'").toLowerCase();

// ---------- category ----------

/** One of the four strict categories, or "other". Accessories ("TV remote", "mobile cover", "shoe rack") fall to "other". */
export function detectCategory(title: string, context = ""): Category {
  // category words may come from breadcrumbs too; accessory words only from the title
  // (Amazon's phone breadcrumb is literally "Mobiles & Accessories")
  const t = low(`${title} ${context}`);
  const ti = low(title);
  const { storage, screen } = parseSpecs(title);
  if (/\b(tv|television)\b/.test(t) && screen !== undefined && screen >= 19 && !/\b(remotes?|sticks?|mounts?|brackets?|stands?|covers?)\b/.test(ti)) return "tv";
  if (/\b(slides?|sandals?|flip[\s-]?flops?|slippers?|heels?|boots?|loafers?|clogs?|rack|polish|cleaner|laces|insoles?|socks)\b/.test(ti)) return "other";
  if (/\b(shoes?|sneakers?|trainers?|footwear)\b/.test(t)) return "shoes";
  if (/\b(t-?shirts?|tees?|polos?|jerseys?)\b/.test(t)) return "tshirt";
  const phoneWord = /\b(smartphones?|mobiles?|iphone|phone)\b/.test(t) || /\d+\s*gb\s*(ram|\+\s*\d+\s*(gb|tb))/.test(t);
  const accessory = /\b(cases?|covers?|chargers?|cables?|holders?|stands?|protectors?|tempered|adapters?|earphones?|headphones?|earbuds|power\s*banks?|tripods?|mounts?)\b/.test(ti);
  if (phoneWord && storage !== undefined && !accessory) return "phone";
  return "other";
}

// ---------- general measures (for "other") ----------

/** Every number-with-a-unit in a text, normalised: 1500 ml → 1.5 l, 1 TB → 1024 gb, "pack of 2" → pack 2. */
export function measures(text: string): Record<string, number[]> {
  const t = low(text).replace(/expandable[^,|)]*/g, "");
  const out: Record<string, number[]> = {};
  const add = (unit: string, v: number) => (out[unit] ??= []).includes(+v.toFixed(3)) || out[unit].push(+v.toFixed(3));
  const units: [RegExp, string, number][] = [
    [/(\d+(?:\.\d+)?)\s*(?:tb)\b/g, "gb", 1024],
    [/(\d+(?:\.\d+)?)\s*(?:gb)\b/g, "gb", 1],
    [/(\d+(?:\.\d+)?)\s*(?:ml|millilit(?:re|er)s?)\b/g, "l", 0.001],
    [/(\d+(?:\.\d+)?)\s*(?:l|ltrs?|lit(?:re|er)s?)\b/g, "l", 1],
    [/(\d+(?:\.\d+)?)\s*(?:kgs?|kilograms?)\b/g, "kg", 1],
    [/(\d+(?:\.\d+)?)\s*(?:gms?|grams?)\b/g, "kg", 0.001], // bare "g" skipped: it's usually "5G"
    [/(\d+(?:\.\d+)?)\s*(?:w|watts?)\b/g, "w", 1],
    [/(\d+(?:\.\d+)?)\s*mah\b/g, "mah", 1],
    [/(\d+(?:\.\d+)?)\s*mm\b/g, "mm", 1],
    [/(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|")/g, "inch", 1],
    [/(?:pack|set|combo)\s*of\s*(\d+)/g, "pack", 1],
    [/(\d+)\s*(?:pcs|pieces|pack)\b/g, "pack", 1],
  ];
  for (const [re, unit, k] of units) for (const m of t.matchAll(re)) add(unit, parseFloat(m[1]) * k);
  return out;
}

/** Units both texts mention must share a value: 1.5 L ≠ 1.8 L, pack of 2 ≠ pack of 1. Units only one side mentions are ignored. */
export function sameMeasures(a: string, b: string): Verdict {
  const ma = measures(a);
  const mb = measures(b);
  for (const u of Object.keys(ma)) {
    if (!mb[u]) continue;
    if (!ma[u].some((x) => mb[u].some((y) => Math.abs(x - y) <= Math.max(x, y) * 0.02)))
      return { ok: false, why: `spec ${mb[u].join("/")} ${u} ≠ ${ma[u].join("/")} ${u}` };
  }
  return { ok: true, why: "" };
}

// ---------- specs ----------

export function parseSpecs(text: string): { ram?: number; storage?: number; screen?: number } {
  const t = low(text).replace(/expandable[^,|)]*/g, ""); // "expandable upto 1 TB" is not storage
  let ram: number | undefined;
  const others: number[] = [];
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(gb|tb)\b(\s*(?:of\s*)?ram)?/g)) {
    const gb = parseFloat(m[1]) * (m[2] === "tb" ? 1024 : 1);
    if (m[3]) ram = gb;
    else others.push(gb);
  }
  let storage: number | undefined;
  const distinct = [...new Set(others)]; // "(256 GB)" in title + "256 GB" spec row is one number, not RAM + storage
  if (distinct.length) {
    storage = Math.max(...distinct);
    if (ram === undefined && distinct.length >= 2) ram = Math.min(...distinct);
  }

  let screen: number | undefined;
  const inch = t.match(/(\d{2,3}(?:\.\d+)?)\s*(?:-?\s*inch(?:es)?\b|in\b|″|")/);
  const cm = t.match(/(\d{2,3}(?:\.\d+)?)\s*cm\b/);
  if (inch) screen = parseFloat(inch[1]);
  else if (cm) screen = Math.round(parseFloat(cm[1]) / 2.54);
  return { ram, storage, screen };
}

// ---------- colour ----------

const COLOUR_FAMILY: Record<string, string> = {};
const FAMILIES: Record<string, string[]> = {
  black: ["black", "blk", "jet", "midnight", "phantom", "onyx", "obsidian", "graphite black", "noir", "charcoal"],
  white: ["white", "wht", "off white", "cream", "ivory", "snow", "pearl", "starlight", "chalk", "sail"],
  grey: ["grey", "gray", "gry", "graphite", "titanium", "silver", "ash", "slate", "smoke", "gunmetal", "space grey"],
  blue: ["blue", "blu", "navy", "nvy", "teal", "aqua", "sky", "cobalt", "indigo", "denim", "icy", "ocean", "turquoise", "cyan"],
  red: ["red", "maroon", "burgundy", "crimson", "wine", "cherry", "scarlet"],
  green: ["green", "grn", "olive", "olv", "mint", "lime", "sage", "emerald", "khaki", "jade"],
  yellow: ["yellow", "mustard", "lemon", "gold", "golden", "amber"],
  orange: ["orange", "rust", "coral", "peach", "tangerine"],
  pink: ["pink", "rose", "magenta", "fuchsia", "blush"],
  purple: ["purple", "violet", "lavender", "lilac", "mauve", "plum"],
  brown: ["brown", "tan", "beige", "camel", "coffee", "chocolate", "mocha", "taupe", "sand"],
  multi: ["multicolor", "multicolour", "multi"],
};
for (const [fam, words] of Object.entries(FAMILIES)) for (const w of words) COLOUR_FAMILY[w] = fam;
const COLOUR_WORDS = Object.keys(COLOUR_FAMILY).sort((a, b) => b.length - a.length);

/** Colour families found in a string, in order of appearance (first = primary). */
export function colourFamilies(text?: string): string[] {
  if (!text) return [];
  const t = ` ${low(text).replace(/[^a-z]+/g, " ")} `;
  const hits: { at: number; fam: string }[] = [];
  let rest = t;
  for (const w of COLOUR_WORDS) {
    const at = rest.indexOf(` ${w} `);
    if (at >= 0) {
      hits.push({ at, fam: COLOUR_FAMILY[w] });
      rest = rest.slice(0, at) + " ".repeat(w.length + 1) + rest.slice(at + w.length + 1); // don't double count
    }
  }
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.fam))];
}

export function sameColour(a?: string, b?: string): boolean {
  const fa = colourFamilies(a);
  const fb = colourFamilies(b);
  if (!fa.length || !fb.length) return false;
  // ponytail: primary colour of either side must appear in the other — good enough for "Black/White" vs "Black"
  return fb.includes(fa[0]) || fa.includes(fb[0]);
}

// ---------- model tokens ----------

const VARIANT = new Set(["pro", "max", "plus", "ultra", "fe", "lite", "mini", "neo", "prime", "air", "edge", "fold", "flip", "easyon", "go", "se"]);
const GENERIC = new Set(
  (
    "smart led qled oled tv television hd uhd fhd full 4k 8k ultrahd android google tizen webos with for and the of in by " +
    "men mens man women womens woman unisex boys girls kids running run shoes shoe sneakers sneaker sports sport casual walking " +
    "training trainers lace up lifestyle t shirt tshirt tee tees polo polos jersey neck round crew collar solid printed graphic slim regular fit " +
    "cotton pure half sleeve sleeves short long dri 5g 4g smartphone mobile phone ai new edition model storage ram rom dual sim " +
    "inch inches cm gb tb display frameless bezel-less series smartchoice"
  ).split(" "),
);

function cleanTitle(title: string, brand: string): string {
  let t = low(title);
  t = t.replace(/ultra\s*hd/g, " "); // "Ultra HD" is a TV feature, not the "Ultra" variant
  t = t.replace(/\([^)]*\)|\[[^\]]*\]/g, " "); // parentheticals hold specs/colour, parsed separately
  t = t.split(/\s[|–-]\s|\||,/)[0]; // drop "| feature list", ", 200MP Camera…", " - colour" tails
  t = t.replace(/\d+(\.\d+)?\s*(gb|tb|cm|mm|inch(es)?|mah|mp|hz|w|watts?|ml|l|ltrs?|lit(re|er)s?|kgs?|gms?|grams?|pcs|pieces)\b/g, " ");
  t = t.replace(/\b(pack|set|combo)\s*of\s*\d+/g, " "); // measures are compared separately
  t = t.replace(/\d+\s*\+\s*\d+/g, " "); // "8GB+128GB" leftovers
  t = t.replace(/\b\d\s*star\b/g, " "); // energy rating
  t = t.replace(/\b20\d\d\b/g, " "); // launch years
  for (const b of brand.toLowerCase().split(/\s+/)) t = t.replace(new RegExp(`\\b${escape(b)}\\b`, "g"), " ");
  for (const w of COLOUR_WORDS) t = t.replace(new RegExp(`\\b${escape(w)}\\b`, "g"), " ");
  return t.replace(/\+/g, " plus ").replace(/'s\b/g, "");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Model numbers like UA55CUE70AKLXL or SM-S721B: letters+digits. `minLen` 5 is safe only for a dedicated "model" field. */
export function findModelNo(text: string, minLen = 7): string | undefined {
  for (const m of text.toUpperCase().matchAll(/\b([A-Z0-9][A-Z0-9-]{3,})\b/g)) {
    const s = m[1].replace(/-/g, "");
    if (/[A-Z]/.test(s) && /\d/.test(s) && s.length >= minLen && !/^\d+(GB|TB|MAH|MP|HZ|CM|W|K)$/.test(s)) return s;
  }
  return undefined;
}

export function modelTokens(title: string, brand: string): string[] {
  return cleanTitle(title, brand)
    .split(/[^a-z0-9+]+/)
    // single letters are kept ("X Series") except size/gender/article noise
    .filter((w) => w && !GENERIC.has(w) && !/^[awsml]$/.test(w) && findModelNo(w) === undefined);
}

function gender(t: string): "m" | "w" | null {
  const s = low(t);
  if (/\bunisex\b/.test(s)) return null;
  if (/\b(women|womens|women's|woman|ladies|girls)\b|^w\s|\sw\s/.test(s)) return "w";
  if (/\b(men|mens|men's|man|boys)\b/.test(s)) return "m";
  return null;
}

// ---------- style (fallback for basics with no model name, e.g. "Allen Solly Men's Polo T-Shirt") ----------

const STYLES: [string, RegExp][] = [
  ["polo", /\bpolo\b|\bcollar(ed)?\b/],
  ["round neck", /\bround[\s-]*neck\b|\bcrew[\s-]*neck\b/],
  ["v-neck", /\bv[\s-]*neck\b/],
  ["henley", /\bhenley\b/],
  ["hooded", /\bhood(ed|ie)?\b/],
  ["printed", /\bprint(ed)?\b|\bgraphic\b/],
  ["striped", /\bstripe[sd]?\b/],
  ["slip-on", /\bslip[\s-]*on\b/],
  ["lace-up", /\blace[\s-]*up\b/],
];
const styles = (t: string) => STYLES.filter(([, re]) => re.test(low(t).split(/\s[|–-]\s|\||,/)[0])).map(([s]) => s);

function sameStyle(srcTitle: string, cTitle: string): Verdict {
  const a = styles(srcTitle);
  const b = styles(cTitle);
  if (!a.length) return { ok: false, why: "no model name or style to compare" };
  const miss = a.find((s) => !b.includes(s));
  if (miss) return { ok: false, why: `not a ${miss}` };
  return { ok: true, why: `no model name on Amazon — matched brand + style (${a.join(", ")}) + colour` };
}

// ---------- the matcher ----------

export interface Verdict {
  ok: boolean;
  why: string;
}

export function sameModel(src: Product, c: Candidate): Verdict {
  const srcNo = src.modelNo;
  const cNo = c.modelNo ?? findModelNo(c.title);
  if (srcNo && cNo) {
    // regional prefixes/suffixes differ (NM2598YM01 vs 2598YM01, …AKLXL vs …AKXXL): drop up to 3 leading letters, compare 8 chars
    const core = (s: string) => s.replace(/^[A-Z]{1,3}(?=\d)/, "").slice(0, 8);
    const same = core(srcNo) === core(cNo) || srcNo.startsWith(cNo) || cNo.startsWith(srcNo);
    if (same) return { ok: true, why: `model number ${cNo}` };
    if (src.category === "tv" || src.category === "other") return { ok: false, why: `model number ${cNo} ≠ ${srcNo}` };
  }

  const S = modelTokens(src.title, src.brand);
  const C = new Set(modelTokens(c.title, c.brand ?? src.brand));
  if (!S.length) {
    if (src.category === "tshirt" || src.category === "shoes") return sameStyle(src.title, c.title);
    return { ok: false, why: "no model words to compare" };
  }

  const hasDigit = (w: string) => /\d/.test(w);
  for (const w of S.filter(hasDigit)) if (!C.has(w)) return { ok: false, why: `missing "${w}"` };
  // general category: the word right after the brand is usually the model name (Omega, Rapid, Rockerz, Karishma)
  if (src.category === "other" && !C.has(S[0])) return { ok: false, why: `model name "${S[0]}" missing` };
  // candidate has a different number in the same slot: "revolution 8" vs 7, "s25" vs "s24", "iphone 16" vs 15
  for (const w of C) {
    if (!hasDigit(w) || S.includes(w)) continue;
    const stem = w.replace(/\d+.*/, "");
    if (/^\d{1,2}$/.test(w) || (stem && S.some((s) => hasDigit(s) && s.replace(/\d+.*/, "") === stem)))
      return { ok: false, why: `different number "${w}"` };
  }
  const vs = S.filter((w) => VARIANT.has(w)).sort().join(",");
  const vc = [...C].filter((w) => VARIANT.has(w)).sort().join(",");
  if (vs !== vc) return { ok: false, why: `variant differs (${vs || "none"} vs ${vc || "none"})` };

  const words = S.filter((w) => !hasDigit(w) && !VARIANT.has(w));
  if (words.length) {
    const hits = words.filter((w) => C.has(w)).length;
    // general category: titles are padded with product-type words ("on ear headphones" vs "headset"),
    // so measure against the shorter side, but demand 2 shared words when there are 2 to share
    const cWords = [...C].filter((w) => !hasDigit(w) && !VARIANT.has(w)).length;
    const denom = src.category === "other" ? Math.max(1, Math.min(words.length, cWords)) : words.length;
    const hit = hits / denom;
    if (hit < 0.6 || (src.category === "other" && hits < Math.min(2, words.length)))
      return { ok: false, why: `only ${Math.round(Math.min(hit, 1) * 100)}% of model words match` };
  }
  return { ok: true, why: `model words ${S.join(" ")}` };
}

export function isSameProduct(src: Product, c: Candidate): Verdict {
  if (c.brand && !brandEq(src.brand, c.brand)) return { ok: false, why: `brand ${c.brand}` };
  if (!c.brand && !c.title.toLowerCase().includes(src.brand.toLowerCase().split(" ")[0]))
    return { ok: false, why: "brand not in title" };

  const g1 = gender(src.title);
  const g2 = gender(c.title);
  if (g1 && g2 && g1 !== g2) return { ok: false, why: "men's vs women's" };

  const m = sameModel(src, c);
  if (!m.ok) return m;

  switch (src.category) {
    case "phone":
      if (src.storage === undefined || c.storage === undefined) return { ok: false, why: "storage unknown" };
      if (src.storage !== c.storage) return { ok: false, why: `storage ${c.storage}GB ≠ ${src.storage}GB` };
      // iPhones etc. don't list RAM; only reject when both sides state it
      if (src.ram !== undefined && c.ram !== undefined && src.ram !== c.ram)
        return { ok: false, why: `RAM ${c.ram}GB ≠ ${src.ram}GB` };
      break;
    case "tv":
      if (src.screen === undefined || c.screen === undefined) return { ok: false, why: "screen size unknown" };
      if (Math.abs(src.screen - c.screen) > 1) return { ok: false, why: `screen ${c.screen}" ≠ ${src.screen}"` };
      break;
    case "shoes":
    case "tshirt":
      if (!sameColour(src.colour, c.colour ?? c.title))
        return { ok: false, why: `colour ${colourFamilies(c.colour ?? c.title).join("/") || "unknown"} ≠ ${src.colour ?? "unknown"}` };
      break;
    case "other": {
      const ms = sameMeasures(src.specText ?? src.title, c.specText ?? c.title);
      if (!ms.ok) return ms;
      // colour only counts when both sides state one
      const cc = c.colour ?? c.title;
      if (colourFamilies(src.colour).length && colourFamilies(cc).length && !sameColour(src.colour, cc))
        return { ok: false, why: `colour ${colourFamilies(cc).join("/")} ≠ ${src.colour}` };
      return { ok: true, why: `general match: ${m.why}` };
    }
  }
  return { ok: true, why: m.why };
}

export function brandEq(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const x = n(a);
  const y = n(b);
  return x === y || x.startsWith(y) || y.startsWith(x); // "HRX by Hrithik Roshan" vs "HRX"
}

/** Among matches prefer: same colour, then in stock. */
export function pickBest(src: Product, matches: Candidate[]): Candidate | undefined {
  const score = (c: Candidate) => (sameColour(src.colour, c.colour ?? c.title) ? 2 : 0) + (c.inStock !== false ? 1 : 0);
  return [...matches].sort((a, b) => score(b) - score(a))[0];
}
