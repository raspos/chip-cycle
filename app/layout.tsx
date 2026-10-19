import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHIP CYCLE — 한국 반도체 수출 20년의 기록 (2007.01~2026.09)",
  description:
    "반도체 수출액은 폭증했는데, 판매 개수는 줄었다 — D램·플래시 메모리·복합구조칩 237개월 통관데이터(711개 관측치)와 한국은행 수출물가지수로 추적한 AI 시대 반도체 슈퍼사이클 다큐멘터리",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
