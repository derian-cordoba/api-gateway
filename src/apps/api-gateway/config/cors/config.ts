const { CORS_ORIGINS, CORS_METHODS, CORS_HEADERS } = process.env;

export type CorsConfig = {
  origins: string | string[];
  methods: string[];
  allowedHeaders: string[];
};

export const corsConfig: CorsConfig = {
  origins: CORS_ORIGINS?.split(",").map((origin: string) => origin.trim()) || "*",
  methods: CORS_METHODS
    ? CORS_METHODS.split(",").map((method: string) => method.trim())
    : ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: CORS_HEADERS
    ? CORS_HEADERS.split(",").map((header: string) => header.trim())
    : ["Content-Type", "Authorization"],
};
