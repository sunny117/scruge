"use client";

import { useState } from "react";

type Result =
  | { platform: string; status: "in_stock" | "out_of_stock"; url: string; title: string; why: string; price?: number }
  | { platform: string; status: "not_listed"; closest?: { title: string; url: string; why: string }; queries: string[] }
  | { platform: string; status: "error"; error: string };

type Product = {
  title: string;
  brand: string;
  category: string;
  ram?: number;
  storage?: number;
  screen?: number;
  colour?: string;
  image?: string;
  url: string;
  price?: number;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const CATEGORY: Record<string, string> = { phone: "Smartphone", tv: "Television", shoes: "Sneakers", tshirt: "T-shirt / polo / jersey", other: "Other · general match" };
const LABEL = { in_stock: "In stock", out_of_stock: "Out of stock", not_listed: "Not listed", error: "Couldn't check" };

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ product: Product; results: Result[] } | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setData(null);
    try {
      const r = await fetch(`/api/match?url=${encodeURIComponent(url)}`);
      const j = await r.json();
      if (!r.ok) setError(j.error);
      else setData(j);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  const p = data?.product;
  const keySpec = p && [
    p.ram && `${p.ram} GB RAM`,
    p.storage && `${p.storage} GB storage`,
    p.screen && `${p.screen}" screen`,
    (p.category === "shoes" || p.category === "tshirt") && p.colour && `Colour: ${p.colour}`,
  ].filter(Boolean);

  return (
    <main>
      <h1>
        Find the <em>same product</em> elsewhere
      </h1>
      <p className="sub">Paste any Amazon product link. Phones, TVs, sneakers and T-shirts get strict matching; anything else gets a general match on brand, model and specs. We check Flipkart, Croma and Myntra.</p>

      <form onSubmit={go}>
        <input
          type="url"
          required
          placeholder="https://www.amazon.in/dp/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Amazon product link"
        />
        <button disabled={loading}>{loading ? "Searching…" : "Find"}</button>
      </form>

      {loading && <p className="sub">Reading Amazon, then searching each platform. This can take 10–30 seconds.</p>}
      {error && <p className="err">{error}</p>}

      {p && (
        <section className="product">
          {p.image && <img src={p.image} alt="" />}
          <div>
            <span className="tag">{CATEGORY[p.category]}</span>
            <h2>{p.title}</h2>
            <p>
              {p.price !== undefined && <b className="amz-price">{inr(p.price)} on Amazon · </b>}
              <b>Brand:</b> {p.brand}
              {keySpec?.length ? <> · {keySpec.join(" · ")}</> : null}
            </p>
          </div>
        </section>
      )}

      {data && (
        <section className="results">
          {data.results.map((r) => (
            <div key={r.platform} className={`card ${r.status}`}>
              <div className="head">
                <h3>{r.platform}</h3>
                <span className="pill">
                  <i />
                  {LABEL[r.status]}
                </span>
              </div>
              {(r.status === "in_stock" || r.status === "out_of_stock") && (
                <>
                  <p className="title">{r.title}</p>
                  {r.price !== undefined && (
                    <p className="price">
                      {inr(r.price)}
                      {p?.price !== undefined && r.price !== p.price && (
                        <span className={r.price < p.price ? "cheaper" : "dearer"}>
                          {inr(Math.abs(p.price - r.price))} {r.price < p.price ? "cheaper" : "more"} than Amazon
                        </span>
                      )}
                      {p?.price !== undefined && r.price === p.price && <span>same as Amazon</span>}
                    </p>
                  )}
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.status === "in_stock" ? "Buy on " : "View on "}
                    {r.platform} →
                  </a>
                  <p className="why">Matched on: {r.why}</p>
                </>
              )}
              {r.status === "not_listed" && (
                <>
                  <p className="title">{r.platform} doesn&apos;t sell this product.</p>
                  {r.closest && (
                    <p className="why">
                      Closest we saw:{" "}
                      <a href={r.closest.url} target="_blank" rel="noreferrer">
                        {r.closest.title}
                      </a>{" "}
                      — rejected because {r.closest.why}.
                    </p>
                  )}
                </>
              )}
              {r.status === "error" && <p className="why">We couldn&apos;t reach {r.platform}: {r.error}</p>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
