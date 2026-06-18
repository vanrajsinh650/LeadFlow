import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LeadFlow - Sales Operations Platform",
  description: "Automated sales lead distribution, duplicate prevention, and SLA tracking dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full bg-slate-50 antialiased`}>
      <body className="flex h-full min-h-screen text-slate-900">
        {/* Left Sidebar (Client Component) */}
        <Sidebar />

        {/* Right Content Wrapper */}
        <div className="flex-1 pl-[260px] flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="text-sm font-medium text-slate-500">
              Operations Center
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                System Active
              </span>
            </div>
          </header>

          {/* Main Workspace Content */}
          <main className="flex-1 w-full max-w-[1400px] mx-auto px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
