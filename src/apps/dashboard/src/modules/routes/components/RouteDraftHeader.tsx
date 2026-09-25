"use client";

import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";

export function RouteDraftHeader({
  baseURL,
  isNew,
  saving,
  onSubmit,
}: {
  baseURL: string;
  isNew: boolean;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <header className="editor-header">
      <div className="editor-header__identity">
        <Link href="/routes" className="icon-button" aria-label="Back to routes">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <span className="eyebrow">{isNew ? "New route" : "Editing route"}</span>
          <h1>{baseURL || "Untitled route"}</h1>
        </div>
      </div>
      <div className="page-actions">
        <Link className="button button--quiet" href="/routes">
          Cancel
        </Link>
        <button
          className="button button--primary"
          type="button"
          disabled={saving}
          onClick={onSubmit}
        >
          {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{" "}
          {saving ? "Applying…" : "Save & apply"}
        </button>
      </div>
    </header>
  );
}
