import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./themes.css";
import ThemeProvider from "@/components/ThemeProvider";
import { DEFAULT_THEME, themeBootstrap } from "@/lib/themes";
export const metadata: Metadata = {
  title: "tabeLog · 探店日记与我的菜单",
  description:
    "探店的惊喜，厨房的烟火。记录吃过的小店和亲手做的菜，私人收藏，也自在分享。",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffcf9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
