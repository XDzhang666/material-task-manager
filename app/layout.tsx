import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "采集工作台 · 任务与物料",
  description: "以物料为中心组织数据采集任务，管理物料款式与参考图片。",
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
    <html lang="zh-CN">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
