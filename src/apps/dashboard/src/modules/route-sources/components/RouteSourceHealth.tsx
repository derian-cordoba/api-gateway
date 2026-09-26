import type { SourceHealth } from "../services/route-sources";

export function RouteSourceHealth({
  health,
  loading,
  error,
  onCheck,
}: {
  health: SourceHealth | null;
  loading: boolean;
  error: string | null;
  onCheck: () => void;
}) {
  return (
    <div aria-live="polite">
      {health && (
        <p>
          Ready · {health.routeCount} routes · revision <code>{health.revision}</code>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="button button--quiet button--small"
        disabled={loading}
        onClick={onCheck}
      >
        {loading ? "Checking…" : "Check source"}
      </button>
    </div>
  );
}
