import type { RouteSourceSummary, SourceRuntimeStatus } from "../services/route-sources";

export function RouteSourceDetails({
  source,
  runtime,
}: {
  source: RouteSourceSummary;
  runtime: SourceRuntimeStatus | null;
}) {
  return (
    <div className="settings-list">
      <p>
        Editing <strong>{source.name}</strong> · {source.driver}
        {source.environment && ` · ${source.environment}`} · key:{" "}
        <code>{source.configurationKey}</code>
      </p>
      {runtime && (
        <>
          <p>
            Gateway source: <strong>{runtime.applied?.sourceId ?? "Not applied"}</strong> ·{" "}
            {runtime.status}
          </p>
          {runtime.desired.version !== runtime.applied?.version && (
            <p>Pending source: {runtime.desired.sourceId}</p>
          )}
          <p>
            Gateway instance: <code>{runtime.instanceId}</code>
          </p>
        </>
      )}
    </div>
  );
}
