import type { Metadata, Viewport } from "next";
import "./globals.css";
import LangHydrator from "@/components/LangHydrator";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1f6e1f",
};

export const metadata: Metadata = {
  title: "ShetBhav - Smart Agricultural Market Intelligence",
  description: "Know the market. Choose better. Earn more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className="font-sans">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <LangHydrator />
        <div className="app-container" id="main-content" role="main">
          {children}
        </div>
      </body>
    </html>
  );
}
