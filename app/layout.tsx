import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Same Product Finder",
  description: "Paste an Amazon link, see the same product on Flipkart, Croma and Myntra.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
