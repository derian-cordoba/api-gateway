"use client";

import { useState } from "react";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import { configurationService } from "@/modules/configuration/services/configuration";
import { useRouteSources } from "../hooks/useRouteSources";
import { useRouteSourceHealth } from "../hooks/useRouteSourceHealth";
import { useRouteSourceActivation } from "../hooks/useRouteSourceActivation";
import type { SourceHealth, SourceRuntimeStatus } from "../services/route-sources";
import { useRouteStorageSelection } from "../hooks/useRouteStorageSelection";
import { RouteStorageDriverSelector } from "./RouteStorageDriverSelector";
import { RouteSourceSelector } from "./RouteSourceSelector";
import { RouteSourceDetails } from "./RouteSourceDetails";
import { RouteSourceHealth } from "./RouteSourceHealth";
import { RouteSourceActivationDialog } from "./RouteSourceActivationDialog";

export function RouteSourcesCard() {
  const { sourceId, saving } = useConfiguration();
  const { data, error, refresh } = useRouteSources();
  const healthState = useRouteSourceHealth(sourceId);
  const activation = useRouteSourceActivation(refresh);
  const [pending, setPending] = useState<{
    health: SourceHealth;
    runtime: SourceRuntimeStatus;
  } | null>(null);
  const { source, driver, matchingSources, selectDriver } = useRouteStorageSelection(
    data?.sources ?? [],
    sourceId,
    configurationService.selectSource,
  );
  const health = healthState.health?.sourceId === sourceId ? healthState.health : null;

  return (
    <section className="settings-card route-sources-card">
      <div>
        <span className="eyebrow">Storage</span>
        <h2>Route sources</h2>
        <p>
          Choose a storage driver and source to edit. Activate the source to switch the gateway to
          that driver; existing routes are not copied automatically.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading sources…</p>}
      {data && (
        <RouteStorageDriverSelector
          sources={data.sources}
          value={driver}
          disabled={saving || !!pending}
          onChange={selectDriver}
        />
      )}
      {data && (
        <RouteSourceSelector
          sources={matchingSources}
          value={sourceId}
          disabled={saving || !!pending}
          onChange={configurationService.selectSource}
        />
      )}
      {source && <RouteSourceDetails source={source} runtime={data?.runtime ?? null} />}
      {data?.runtimeError && <p role="status">{data.runtimeError}</p>}
      <RouteSourceHealth {...healthState} health={health} onCheck={healthState.check} />
      {data?.runtime && !data.runtime.activationEnabled && (
        <p>Activation requires a gateway control database.</p>
      )}
      <div className="route-source-actions">
        <button type="button" className="button button--quiet button--small" onClick={refresh}>
          Refresh status
        </button>
        {data?.runtime?.activationEnabled && (
          <button
            type="button"
            className="button button--primary"
            disabled={!health || saving || healthState.loading || activation.activating}
            onClick={() => {
              if (health && data.runtime) {
                setPending({ health, runtime: data.runtime });
              }
            }}
          >
            Activate source…
          </button>
        )}
      </div>
      {pending && source && (
        <RouteSourceActivationDialog
          source={source}
          health={pending.health}
          busy={activation.activating}
          error={activation.error}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            void (async () => {
              if (await activation.activate(pending.health, pending.runtime)) {
                setPending(null);
              }
            })();
          }}
        />
      )}
    </section>
  );
}
