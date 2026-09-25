import type { StoredConfiguration } from "@/modules/configuration/types/configuration.types";

export function RoutesStatusStrip({
  configuration,
  saving,
}: {
  configuration: StoredConfiguration;
  saving: boolean;
}) {
  return (
    <div className="status-strip">
      <span>
        <i className="status-dot" /> Local JSON active
      </span>
      <span>{configuration.routes.length} routes</span>
      <span>
        Revision <code>{configuration.revision}</code>
      </span>
      {saving && <span>Applying changes…</span>}
    </div>
  );
}
