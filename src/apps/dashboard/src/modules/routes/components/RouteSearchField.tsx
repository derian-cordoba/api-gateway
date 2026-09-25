"use client";

import { Search } from "lucide-react";

export function RouteSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="toolbar">
      <label className="search-field">
        <Search size={17} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search routes or upstreams"
          aria-label="Search routes"
        />
      </label>
    </div>
  );
}
