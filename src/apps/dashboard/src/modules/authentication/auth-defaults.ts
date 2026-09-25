import type { Auth } from "./authentication-editor.types";

export const authDefaults: Record<Auth["strategy"], Auth> = {
  jwt: { enabled: true, strategy: "jwt", secret: "" },
  apiKey: { enabled: true, strategy: "apiKey", header: "x-api-key", keys: [""] },
  basicAuth: {
    enabled: true,
    strategy: "basicAuth",
    realm: "API Gateway",
    credentials: [{ username: "", password: "" }],
  },
  oauth2: {
    enabled: true,
    strategy: "oauth2",
    introspectionUrl: "",
    clientId: "",
    clientSecret: "",
  },
};
