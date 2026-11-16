# How the matching works (explained like you're 5)

Imagine you have a toy car, and you want to know if two other toy shops sell **the exact same car**.

## 1. Look closely at your toy

We open the Amazon page and write down what's on the label:

- **Who made it?** That's the brand, like *Samsung* or *Nike*.
- **What's it called?** That's the model, like *Galaxy S24 FE* or *Revolution 7*.
- **One special detail**, which depends on the kind of toy:

| Kind of toy | Special detail we check | Shops we visit |
|---|---|---|
| Phone | How much memory it has (RAM and storage, like 8 GB + 128 GB) | Flipkart, Croma |
| TV | How big the screen is (like 55 inches) | Flipkart, Croma |
| Sneakers | What colour they are | Flipkart, Myntra |
| T-shirt | What colour it is | Flipkart, Myntra |

## 2. Ask each shop "do you have this?"

We go to each shop and say the name out loud: *"Samsung Galaxy S24 FE, 128 GB"*.
The shop shows us a pile of toys that sound a bit like that.

If the pile is wrong, we ask again in a different way, e.g. by the model number printed on the box, or with fewer words. We ask at most 3 times.

## 3. Check every toy in the pile, one by one

A toy only counts as **the same** if it passes every check:

1. **Same maker.** A Puma shoe is never a Nike shoe.
2. **Same name.** Every number in the name must match: *Revolution 7* is not *Revolution 8*, and *S24* is not *S25*.
3. **No extra power words.** *iPhone 15* is not *iPhone 15 **Plus***, and *S24 FE* is not *S24 **Ultra***. Words like Pro, Max, Plus, Ultra, Lite, Mini and FE make it a different toy.
4. **Same special detail:**
   - Phones: same storage, and same RAM if both shops say what it is.
   - TVs: same screen size. Some shops measure in centimetres, so we convert (139 cm ≈ 55 inches).
   - Sneakers and T-shirts: same colour. Shops use fancy names, so we know that *Jet Black*, *Midnight* and *BLK* all mean **black**, and *Navy* and *Cobalt* both mean **blue**.
5. **Men's vs women's.** A women's shoe is not the same as the men's version.

TVs often have a secret code on the box (like `UA55CUE70AKLXL`). If both shops show that code and it matches, we know right away it's the same TV.

Some T-shirts have no name at all, just *"Allen Solly Men's Polo"*. For those we check maker + style (polo, round neck, V-neck…) + colour, and the result says so.

## 3½. Any other toy (kettles, earphones, watches, bags…)

If the toy isn't a phone, TV, sneaker or T-shirt, we still try. We visit **all three shops**, because a shop that doesn't sell that kind of toy just says "not listed". Then we check:

1. **Same maker.**
2. **Same name.** The word right after the brand is usually the toy's name (*Rockerz*, *Karishma*, *Omega*), so it must be there too. Numbers in the name must match, and so must power words like Pro or Plus.
3. **Same box code**, if both shops show one. A Titan watch `2598YM01` is not `2594YM01`. When there's a box code, we keep looking until we find a listing with the exact code.
4. **Every measurement both shops mention must agree.** A 1.5 litre kettle is not a 1.8 litre one, and a pack of 2 is not a pack of 1. We know 1500 ml is the same as 1.5 litres.
5. **Same colour, if both shops say one.**

These answers are marked **"general match"**, because the rules are looser than for the four main kinds of toy.

## 4. Tell you what we found

For each shop you get one of three answers:

- 🟢 **In stock**: we found the same toy and you can buy it. Here's the link.
- 🟡 **Out of stock**: we found the same toy, but you can't buy it right now. Here's the link anyway.
- ⚪ **Not listed**: this shop doesn't sell that toy. We also show the closest one we saw and why it didn't count, e.g. *"storage 128 GB ≠ 256 GB"*.

When we find the toy, we also show **its price** on that shop and how much cheaper or dearer it is than on Amazon.

If a shop's door was locked (the website blocked us), we say **"Couldn't check"** instead of pretending it's not there.

## How we know if it's in stock

- **Flipkart** tells us on the search page ("IN_STOCK"), or on the product page.
- **Croma** lists which stores have it. An empty list means out of stock.
- **Myntra** has an "out of stock" flag on the product page.

## Why no AI?

Every rule above is simple enough to write down, so the computer follows the rules instead of guessing. That makes it fast and free, gives the same answer every time, and always tells you **why** two things matched.
