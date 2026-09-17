import type { Metadata } from "next";
import { RoutesPage } from "@/modules/routes/pages/RoutesPage";

export const metadata: Metadata = { title: "Routes" };

export default function Page() {
  return <RoutesPage />;
}
