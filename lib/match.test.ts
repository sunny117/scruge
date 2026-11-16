// Run: npm test   (titles below are real ones seen on Amazon / Flipkart / Croma / Myntra)
import { test } from "node:test";
import assert from "node:assert/strict";
import { colourFamilies, detectCategory, findModelNo, isSameProduct, measures, parseSpecs, type Candidate, type Product } from "./match";

const cand = (title: string, extra: Partial<Candidate> = {}, specText = title): Candidate => ({
  title,
  url: "x",
  ...parseSpecs(specText),
  ...extra,
});
const ok = (p: Product, c: Candidate) => assert.equal(isSameProduct(p, c).ok, true, isSameProduct(p, c).why);
const no = (p: Product, c: Candidate) => assert.equal(isSameProduct(p, c).ok, false, `should reject ${c.title}`);

test("parseSpecs", () => {
  assert.deepEqual(parseSpecs("Galaxy S24 FE (Blue, 8GB RAM, 128GB Storage)"), { ram: 8, storage: 128, screen: undefined });
  assert.deepEqual(parseSpecs("Samsung Galaxy S24 FE 5G (Blue, 128 GB) , 8 GB RAM"), { ram: 8, storage: 128, screen: undefined });
  assert.deepEqual(parseSpecs("Samsung Galaxy S25 FE (8GB+512GB)Navy"), { ram: 8, storage: 512, screen: undefined });
  assert.equal(parseSpecs("Phone (8 GB RAM, 1 TB)").storage, 1024);
  assert.deepEqual(parseSpecs("Apple iPhone 15 (256 GB) - Black , 256 GB"), { ram: undefined, storage: 256, screen: undefined });
  assert.equal(parseSpecs("6 GB RAM | 128 GB ROM | Expandable Upto 1 TB").storage, 128);
  assert.equal(parseSpecs("Samsung 138 cm (55 inches) Crystal 4K").screen, 55);
  assert.equal(parseSpecs("LG 139 cm 4K TV").screen, 55);
});

test("detectCategory", () => {
  assert.equal(detectCategory("Samsung 138 cm (55 inches) Crystal 4K Smart LED TV"), "tv");
  assert.equal(detectCategory("Apple iPhone 15 (256 GB) - Black"), "phone");
  assert.equal(detectCategory("Nike Mens Revolution 7 Running Shoe"), "shoes");
  assert.equal(detectCategory("U.S. POLO ASSN. Men Sneakers"), "shoes"); // "Polo" brand, still shoes
  assert.equal(detectCategory("Puma Mens Regular Fit Polo T-Shirt"), "tshirt");
  assert.equal(detectCategory("Prestige Pressure Cooker 5L"), "other");
  assert.equal(detectCategory("Puma Unisex Adult Geo Slide Electronics›Shoes"), "other");
  assert.equal(detectCategory("Spigen Rugged Armor Back Cover Case for Samsung Galaxy S24 FE"), "other"); // accessory, not a phone
  assert.equal(detectCategory("Samsung Smart TV Remote Control"), "other");
  assert.equal(detectCategory("boAt Rockerz 450 Bluetooth On Ear Headphones"), "other");
});

test("colours and model numbers", () => {
  assert.deepEqual(colourFamilies("Off White/Black"), ["white", "black"]);
  assert.deepEqual(colourFamilies("Graphite"), ["grey"]);
  assert.equal(findModelNo("Smart LED TV UA55CUE70AKLXL (Black)"), "UA55CUE70AKLXL");
  assert.equal(findModelNo("Galaxy S24 FE 5G 128GB"), undefined);
});

test("smartphones: brand + model + RAM + storage", () => {
  const s24: Product = { title: "Samsung Galaxy S24 FE 5G AI Smartphone (Blue, 8GB RAM, 128GB Storage)", brand: "Samsung", category: "phone", ram: 8, storage: 128 };
  ok(s24, cand("Samsung Galaxy S24 FE 5G (Blue, 128 GB)", { brand: "Samsung" }, "Samsung Galaxy S24 FE 5G (Blue, 128 GB) , 8 GB RAM"));
  ok(s24, cand("SAMSUNG Galaxy S24 FE 5G (8GB RAM, 128GB, Graphite)", { brand: "Samsung" })); // other colour is fine for phones
  no(s24, cand("Samsung Galaxy S24 FE 5G (Blue, 256 GB)", { brand: "Samsung" }, "(Blue, 256 GB) 8 GB RAM"));
  no(s24, cand("SAMSUNG Galaxy S25 FE 5G (8GB RAM, 128GB, Navy)", { brand: "Samsung" }));
  no(s24, cand("SAMSUNG Galaxy S24 Ultra 5G (8GB RAM, 128GB, Black)", { brand: "Samsung" }));
  no(s24, cand("SAMSUNG Galaxy S24 5G (8GB RAM, 128GB, Black)", { brand: "Samsung" })); // FE vs plain
  no(s24, cand("Samsung Galaxy S24 FE 5G (Blue, 128 GB)", { brand: "Samsung" }, "(Blue, 128 GB) , 12 GB RAM"));

  const ip: Product = { title: "Apple iPhone 15 (256 GB) - Black", brand: "Apple", category: "phone", storage: 256 };
  ok(ip, cand("Apple iPhone 15 (Black, 256 GB)", { brand: "Apple" })); // no RAM listed anywhere: still a match
  no(ip, cand("Apple iPhone 15 Plus (Black, 256 GB)", { brand: "Apple" }));
  no(ip, cand("Apple iPhone 16 (Black, 256 GB)", { brand: "Apple" }));
  no(ip, cand("Apple iPhone 15 (Black, 128 GB)", { brand: "Apple" }));
});

test("televisions: brand + model + screen size", () => {
  const tv: Product = {
    title: "Samsung 138 cm (55 inches) Crystal 4K Vision Pro Ultra HD Smart LED TV UA55CUE70AKLXL (Black)",
    brand: "Samsung",
    category: "tv",
    screen: 55,
    modelNo: "UA55CUE70AKLXL",
  };
  ok(tv, cand("SAMSUNG Crystal 4K Vision Pro 138 cm (55 inch) Ultra HD (4K) LED Smart Tizen TV", { brand: "Samsung", modelNo: "UA55CUE70AKXXL" }));
  ok(tv, cand("SAMSUNG Crystal 4K Vision Pro 138 cm (55 inch) 4K Ultra HD LED Tizen TV with Bixby", { brand: "Samsung" })); // Croma: no model no
  no(tv, cand("Samsung Crystal 4K Vision AI 138 cm (55 inch) Ultra HD (4K) LED Smart Tizen TV 2026 Edition", { brand: "Samsung", modelNo: "UA55UE83AHULXL" }));
  no(tv, cand("SAMSUNG Crystal 4K Vision Pro 108 cm (43 inch) 4K Ultra HD LED Tizen TV", { brand: "Samsung" }));
});

test("sneakers: brand + model + colour", () => {
  const shoe: Product = { title: "Nike Mens Revolution 7 Running Shoe", brand: "Nike", category: "shoes", colour: "Black/White" };
  ok(shoe, cand("NIKE REVOLUTION 7 Running Shoes For Men", { brand: "NIKE", colour: "Black" }));
  no(shoe, cand("Nike Revolution 8 Men's Road Running Shoes", { brand: "Nike", colour: "Black" }));
  no(shoe, cand("NIKE W REVOLUTION 7 Running Shoes For Women", { brand: "NIKE", colour: "Black" }));
  no(shoe, cand("NIKE Revolution 7 Running Shoes For Men", { brand: "NIKE", colour: "Blue" }));
  no(shoe, cand("Puma Revolution 7 Running Shoes For Men", { brand: "Puma", colour: "Black" }));
});

test("t-shirts: brand + model + colour", () => {
  const tee: Product = { title: "Puma Mens Ess Logo Polo T-Shirt", brand: "Puma", category: "tshirt", colour: "Puma Black" };
  ok(tee, cand("Puma Men ESS Logo Polo Collar T-shirt", { brand: "Puma", colour: "Black" }));
  no(tee, cand("Puma Men ESS Logo Polo Collar T-shirt", { brand: "Puma", colour: "White" }));
  no(tee, cand("Puma Men Performance Polo", { brand: "Puma", colour: "Black" }));

  // basics with no model name fall back to brand + style + colour (fancy unicode hyphen/apostrophe from Amazon)
  const basic: Product = { title: "Allen Solly Men’s Polo T‑Shirt | Comfortable Rich Cotton Blend, Band Collar", brand: "Allen Solly", category: "tshirt", colour: "Jet Black" };
  ok(basic, cand("Allen Solly Solid Men Polo Neck Black T-Shirt", { brand: "Allen Solly", colour: "Black" }));
  no(basic, cand("Allen Solly Men Round Neck Black T-Shirt", { brand: "Allen Solly", colour: "Black" }));
  no(basic, cand("Allen Solly Women Polo Neck Black T-Shirt", { brand: "Allen Solly", colour: "Black" }));
});

test("colour codes", () => {
  const shoe: Product = { title: "Campus Men Oxyfit (N) Walking Shoes", brand: "Campus", category: "shoes", colour: "BLK" };
  ok(shoe, cand("CAMPUS OXYFIT (N) Men's Casual Shoes", { brand: "CAMPUS", colour: "Black" }));
});

test("measures", () => {
  assert.deepEqual(measures("Prestige Electric Kettle 1.5 Litre, 1500W"), { l: [1.5], w: [1500] });
  assert.deepEqual(measures("Milton Bottle 1000 ml (Pack of 2)"), { l: [1], pack: [2] });
  assert.deepEqual(measures("Samsung 5G Phone"), {}); // "5G" is not 5 grams
});

test("general category: brand + model + shared specs (+ colour when both state one)", () => {
  const kettle: Product = { title: "Prestige PKOSS 1.5 Litre Electric Kettle, 1500W", brand: "Prestige", category: "other", specText: "Prestige PKOSS 1.5 Litre Electric Kettle, 1500W" };
  ok(kettle, cand("Prestige PKOSS 1500 W Electric Kettle (1.5 L, Silver)", { brand: "Prestige" }));
  no(kettle, cand("Prestige PKOSS 1500 W Electric Kettle (1.8 L, Silver)", { brand: "Prestige" }));

  const phones: Product = { title: "boAt Rockerz 450 Bluetooth On Ear Headphones", brand: "boAt", category: "other", colour: "Luscious Black", specText: "boAt Rockerz 450 Bluetooth On Ear Headphones" };
  ok(phones, cand("boAt Rockerz 450 Bluetooth Headset (Luscious Black, On the Ear)", { brand: "boAt" }));
  no(phones, cand("boAt Rockerz 550 Bluetooth Headset (Black, On the Ear)", { brand: "boAt" }));
  no(phones, cand("boAt Rockerz 450 Bluetooth Headset (Aqua Blue, On the Ear)", { brand: "boAt" }));
  no(phones, cand("boAt Rockerz 450 Pro Bluetooth Headset (Black)", { brand: "boAt" }));

  const bottle: Product = { title: "Milton Thermosteel Flip Lid Flask, 1000 ml, Pack of 2", brand: "Milton", category: "other", specText: "Milton Thermosteel Flip Lid Flask, 1000 ml, Pack of 2" };
  no(bottle, cand("MILTON Thermosteel Flip Lid 1000 ml Flask (Pack of 1)", { brand: "Milton" }));
});

test("general category: model numbers and model name", () => {
  const titan: Product = { title: "Titan Karishma Analog Champagne Dial Women's Watch -NM2598YM01", brand: "Titan", category: "other", modelNo: "NM2598YM01" };
  ok(titan, cand("Titan 2598YM01 Karishma Champagne Dial Analog Watch - For Women", { brand: "Titan" })); // regional prefix dropped
  no(titan, cand("Titan 2594YM01 Karishma Champagne Dial Analog Watch - For Women", { brand: "Titan" }));

  const bag: Product = { title: "Safari Omega spacious/large laptop backpack with Raincover, Black", brand: "Safari", category: "other" };
  no(bag, cand("SAFARI Warrior 30 L Laptop Backpack", { brand: "Safari" }));
  ok(bag, cand("Safari Omega 30 L Laptop Backpack with Raincover (Black)", { brand: "Safari" }));

  // breadcrumb "Mobiles & Accessories" must not demote a phone
  assert.equal(detectCategory("Samsung Galaxy S25 Ultra 5G AI Smartphone (12GB RAM, 256GB Storage)", "Electronics›Mobiles & Accessories›Smartphones"), "phone");
});
