import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en" dir="ltr">
      <body>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <div className="app-container" id="main-content" role="main">
          {children}
        </div>
      </body>
    </html>
  );
}
