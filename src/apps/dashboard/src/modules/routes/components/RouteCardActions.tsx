"use client";

import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";

export function RouteCardActions({
  baseURL,
  index,
  onDuplicate,
  onDelete,
}: {
  baseURL: string;
  index: number;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="route-card__actions">
      <button
        type="button"
        className="icon-button"
        onClick={onDuplicate}
        aria-label={`Duplicate ${baseURL}`}
      >
        <Copy size={17} />
      </button>
      <Link
        className="icon-button"
        href={`/routes/edit?index=${index}`}
        aria-label={`Edit ${baseURL}`}
      >
        <Pencil size={17} />
      </Link>
      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={onDelete}
        aria-label={`Delete ${baseURL}`}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
