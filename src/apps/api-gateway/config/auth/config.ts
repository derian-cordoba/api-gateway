const {
  JWT_SECRET,
  JWT_PUBLIC_KEY,
} = process.env;

export type AuthConfig = {
  jwtSecret: string | undefined;
  jwtPublicKey: string | undefined;
};

export const authConfig: AuthConfig = {
  jwtSecret: JWT_SECRET,
  jwtPublicKey: JWT_PUBLIC_KEY,
} as const satisfies AuthConfig;
