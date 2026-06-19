export type EnvConfig = {
  isDev: boolean;
};

export const envConfig: EnvConfig = {
  isDev: process.env.NODE_ENV !== "production",
};
