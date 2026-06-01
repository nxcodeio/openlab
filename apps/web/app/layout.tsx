import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "OpenLab",
  description: "Browser-native AI-first technical computing notebook. MATLAB syntax. Zero install.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
