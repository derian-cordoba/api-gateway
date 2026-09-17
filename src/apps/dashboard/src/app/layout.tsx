import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/modules/shared/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "API Gateway", template: "%s · API Gateway" },
  description: "Visual configuration dashboard for the API gateway.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
