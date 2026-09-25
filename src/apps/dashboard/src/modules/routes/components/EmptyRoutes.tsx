import Link from "next/link";
import { Plus, Route as RouteIcon } from "lucide-react";

export function EmptyRoutes() {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <RouteIcon size={28} />
      </div>
      <h2>No routes configured</h2>
      <p>Create the first route to start forwarding gateway traffic.</p>
      <Link className="button button--primary" href="/routes/edit">
        <Plus size={17} /> Create route
      </Link>
    </div>
  );
}
