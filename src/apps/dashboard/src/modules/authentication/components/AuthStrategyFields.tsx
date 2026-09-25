"use client";

import type { Auth } from "../authentication-editor.types";
import { JwtFields } from "./JwtFields";
import { ApiKeyFields } from "./ApiKeyFields";
import { BasicFields } from "./BasicFields";
import { OAuthFields } from "./OAuthFields";

export function AuthStrategyFields({
  value,
  onChange,
}: {
  value: Auth;
  onChange: (value: Auth) => void;
}) {
  switch (value.strategy) {
    case "jwt":
      return <JwtFields value={value} onChange={onChange} />;
    case "apiKey":
      return <ApiKeyFields value={value} onChange={onChange} />;
    case "basicAuth":
      return <BasicFields value={value} onChange={onChange} />;
    case "oauth2":
      return <OAuthFields value={value} onChange={onChange} />;
  }
}
