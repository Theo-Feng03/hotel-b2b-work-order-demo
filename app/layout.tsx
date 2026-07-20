import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅协工单｜酒店 B2B 国内客服工作台",
  description: "酒店 B2B 国内客服工单协同与处理 Demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
