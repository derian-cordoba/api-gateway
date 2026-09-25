import { AlertCircle } from "lucide-react";
import { DashboardApiError } from "@/modules/configuration/services/configuration";

export function RouteSaveError({ error }: { error: Error }) {
  const issues = error instanceof DashboardApiError ? error.issues : [];
  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Could not apply this route</strong>
        <p>{error.message}</p>
        {issues.length > 0 && (
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>
                <code>{issue.path.join(".")}</code> {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
