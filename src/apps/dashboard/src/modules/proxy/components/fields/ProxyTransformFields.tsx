"use client";

import { KeyValueEditor } from "@/modules/shared/components/FormControls";
import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";

export function ProxyTransformFields({
  value,
  update,
}: {
  value: ProxyConfig;
  update: UpdateProxy;
}) {
  return (
    <>
      <div className="subsection-grid">
        <div>
          <h3>Path rewrites</h3>
          <p>Regular expression and replacement pairs.</p>
          <KeyValueEditor
            value={value.pathRewrite}
            onChange={(pathRewrite) => update({ pathRewrite })}
            keyPlaceholder="^/api"
            valuePlaceholder=""
          />
        </div>
        <div>
          <h3>Upstream headers</h3>
          <p>Headers added to every proxied request.</p>
          <KeyValueEditor
            value={value.headers}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="X-Service-Key"
            valuePlaceholder="Value"
          />
        </div>
      </div>
    </>
  );
}
