"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Network, Route, Settings } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: "/routes", label: "Routes", icon: Route },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/routes" className="brand">
          <span className="brand__mark">
            <Network size={21} />
          </span>
          <span>
            <strong>API Gateway</strong>
            <small>Gateway control</small>
          </span>
        </Link>
        <nav>
          {items.map(({ href, label, icon: Icon }) => (
            <Link href={href} className={pathname.startsWith(href) ? "active" : ""} key={href}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="status-pill">
            <Activity size={14} /> Local driver
          </span>
          <small>Next.js dashboard</small>
        </div>
      </aside>
      <div className="main-surface">{children}</div>
    </div>
  );
}
