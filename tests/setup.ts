// Set env vars before any module is imported so logger and config singletons
// pick up these values at initialisation time.
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
