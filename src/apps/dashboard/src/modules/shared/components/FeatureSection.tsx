"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Toggle } from "./FormControls";

export function FeatureSection({
  id,
  title,
  description,
  enabled,
  required = false,
  onEnabledChange,
  children,
}: {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  required?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className={enabled ? "feature-section feature-section--enabled" : "feature-section"}
      open={required || enabled}
      id={id}
    >
      <summary>
        <div>
          <div className="feature-section__title-row">
            <h2>{title}</h2>
            {required ? <span className="badge badge--required">Required</span> : null}
          </div>
          <p>{description}</p>
        </div>
        <div className="feature-section__actions" onClick={(event) => event.preventDefault()}>
          {!required && onEnabledChange ? (
            <Toggle checked={enabled} onChange={onEnabledChange} label={`Enable ${title}`} />
          ) : null}
          <ChevronDown className="feature-section__chevron" size={18} />
        </div>
      </summary>
      {enabled ? <div className="feature-section__body">{children}</div> : null}
    </details>
  );
}
