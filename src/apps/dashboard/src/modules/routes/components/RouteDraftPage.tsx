"use client";

import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import type {
  GatewayRoute,
  StoredConfiguration,
} from "@/modules/configuration/types/configuration.types";
import { useRouteDraft } from "../hooks/useRouteDraft";
import { EditorNavigation } from "./EditorNavigation";
import { RouteDraftHeader } from "./RouteDraftHeader";
import { RouteEditor } from "./RouteEditor";
import { RouteSaveError } from "./RouteSaveError";
import { RouteSummary } from "./RouteSummary";

export function RouteDraftPage({
  configuration,
  index,
  initialRoute,
  saving,
  save,
}: {
  configuration: StoredConfiguration;
  index: number | null;
  initialRoute: GatewayRoute;
  saving: boolean;
  save: ReturnType<typeof useConfiguration>["save"];
}) {
  const { route, setRoute, saveError, enabledSections, submit } = useRouteDraft({
    configuration,
    index,
    initialRoute,
    save,
  });

  return (
    <main className="editor-page">
      <RouteDraftHeader
        baseURL={route.baseURL}
        isNew={index === null}
        saving={saving}
        onSubmit={() => void submit()}
      />
      <div className="editor-layout">
        <EditorNavigation enabledSections={enabledSections} />
        <div className="editor-content">
          {saveError && <RouteSaveError error={saveError} />}
          <RouteEditor value={route} onChange={setRoute} />
        </div>
        <RouteSummary route={route} enabledCount={enabledSections.size - 1} />
      </div>
    </main>
  );
}
