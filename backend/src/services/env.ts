function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  port: Number(optional('PORT', '4000')),
  accessTokenSecret: required('ACCESS_TOKEN_SECRET'),
  refreshTokenSecret: required('REFRESH_TOKEN_SECRET'),
  refreshTokenTtlDays: Number(optional('REFRESH_TOKEN_TTL_DAYS', '90')),
  maxUploadMb: Number(optional('MAX_UPLOAD_MB', '15')),
  frontendOrigin: process.env.FRONTEND_ORIGIN,
};
