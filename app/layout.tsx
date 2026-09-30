import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./visitors.css";

export const metadata: Metadata = {
  title: "READi 근태관리",
  description: "READi 임직원 근태 신청 및 조회",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1d566b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
