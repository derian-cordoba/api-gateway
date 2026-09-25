"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { FormField, TextInput } from "@/modules/shared/components/FormControls";
import { useDashboardToken } from "../hooks/useDashboardToken";

export function DashboardTokenCard({ onSaved }: { onSaved: () => void }) {
  const { token, setToken, saved, save, isVisible, copyStatus, showToken, hideToken, copyToken } =
    useDashboardToken(onSaved);

  return (
    <section className="settings-card">
      <div className="settings-card__heading">
        <span className="settings-card__icon">
          <KeyRound size={20} />
        </span>
        <div>
          <h2>Dashboard access token</h2>
          <p>Stored only in this browser and sent with configuration requests.</p>
        </div>
      </div>
      <FormField label="Token">
        <div className="dashboard-token__input-row">
          <TextInput
            type={isVisible ? "text" : "password"}
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Required when DASHBOARD_TOKEN is configured"
          />
          <button
            className="button button--quiet button--small"
            type="button"
            disabled={!token}
            onClick={isVisible ? hideToken : showToken}
            aria-label={isVisible ? "Hide dashboard token" : "Show dashboard token for 30 seconds"}
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            {isVisible ? "Hide" : "Show"}
          </button>
          <button
            className="button button--quiet button--small"
            type="button"
            disabled={!token}
            onClick={() => void copyToken()}
          >
            {copyStatus === "copied" ? <Check size={16} /> : <Copy size={16} />}
            {copyStatus === "copied" ? "Copied" : "Copy"}
          </button>
        </div>
        {copyStatus === "failed" && (
          <span className="form-field__hint" role="status">
            Could not copy the token. Check your browser clipboard permissions.
          </span>
        )}
      </FormField>
      <button className="button button--primary" type="button" onClick={save}>
        {saved ? <Check size={17} /> : <Save size={17} />}
        {saved ? "Saved" : "Save token"}
      </button>
    </section>
  );
}
