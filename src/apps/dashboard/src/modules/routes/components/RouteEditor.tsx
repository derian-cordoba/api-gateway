"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { omitUndefined } from "@shared/objects/omitUndefined";
import { useRawRouteEditor } from "../hooks/useRawRouteEditor";
import { RawRouteEditor } from "./RawRouteEditor";
import { RouteBasics } from "./RouteBasics";
import { RouteFeatureStack } from "./RouteFeatureStack";

export function RouteEditor({
  value,
  onChange,
}: {
  value: GatewayRoute;
  onChange: (value: GatewayRoute) => void;
}) {
  const { rawMode, raw, rawError, setRaw, toggleRaw } = useRawRouteEditor(value, onChange);
  const patch = (next: Partial<GatewayRoute>) => onChange(omitUndefined({ ...value, ...next }));

  return (
    <>
      <RouteBasics
        baseURL={value.baseURL}
        rawMode={rawMode}
        onBaseURLChange={(baseURL) => patch({ baseURL })}
        onToggleRaw={toggleRaw}
      />
      {rawMode ? (
        <RawRouteEditor value={raw} error={rawError} onChange={setRaw} />
      ) : (
        <RouteFeatureStack value={value} onPatch={patch} />
      )}
    </>
  );
}
