import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Metadata PWA & SEO Global
export const metadata: Metadata = {
  title: "MatrixPaint — B2B SaaS POS & Inventory",
  description: "Sistem POS dan Inventory Multi-Cabang Toko Cat Dunia Warna",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MatrixPaint",
  },
};

// 2. Viewport PWA (Theme color slate-950 & Lock Scale agar HP Kasir nyaman)
export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-950 text-slate-100">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Global di Kiri */}
          <Sidebar />

          {/* Area Konten Utama di Kanan */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}