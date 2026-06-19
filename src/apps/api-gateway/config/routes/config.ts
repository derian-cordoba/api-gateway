export type RoutesConfig = {
  filePath: string;
};

export const routesConfig: RoutesConfig = {
  filePath: process.env.ROUTES_FILE_PATH || "routes.json",
};
