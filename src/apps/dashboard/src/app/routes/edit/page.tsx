import type { Metadata } from "next";
import { Suspense } from "react";
import { EditRoutePage } from "@/modules/routes/pages/EditRoutePage";

export const metadata: Metadata = { title: "Route editor" };

export default function Page() {
  return <Suspense fallback={
    <main className="page">
      <div className="editor-loading">Loading route editor…</div>
    </main>
  }>
    <EditRoutePage />
  </Suspense>;
}

