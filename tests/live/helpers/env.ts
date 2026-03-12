type LiveRole = "ADMIN" | "LEARNER" | "EXPERT" | "ENTERPRISE";

function getProductionBaseUrl(): string {
  return (process.env.PRODUCTION_BASE_URL || "https://ai-world.asia").trim();
}

function getStagingBaseUrl(): string | null {
  const value = process.env.STAGING_BASE_URL?.trim();
  return value ? value : null;
}

export function getLiveBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    getStagingBaseUrl() ||
    getProductionBaseUrl()
  );
}

export function isProductionBaseUrl(url: string): boolean {
  return url.replace(/\/$/, "") === getProductionBaseUrl().replace(/\/$/, "");
}

function getCredentialEnvKeys(role: LiveRole) {
  const isProduction = isProductionBaseUrl(getLiveBaseUrl());
  const emailKeys = isProduction
    ? [`LIVE_${role}_EMAIL`]
    : [`LIVE_${role}_EMAIL_STAGING`, `LIVE_${role}_EMAIL`];
  const passwordKeys = isProduction
    ? [`LIVE_${role}_PASSWORD`]
    : [`LIVE_${role}_PASSWORD_STAGING`, `LIVE_${role}_PASSWORD`];

  return { emailKeys, passwordKeys };
}

function getFirstEnvValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function getLiveCredentials(role: LiveRole) {
  const keys = getCredentialEnvKeys(role);
  const email = getFirstEnvValue(keys.emailKeys);
  const password = getFirstEnvValue(keys.passwordKeys);

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export function getMissingLiveCredentialsMessage(role: LiveRole): string {
  const keys = getCredentialEnvKeys(role);

  return `Missing live credentials for ${role}. Set ${keys.emailKeys.join(" or ")} and ${keys.passwordKeys.join(" or ")} before running live Playwright.`;
}

export function requireLiveCredentials(role: LiveRole) {
  const credentials = getLiveCredentials(role);

  if (!credentials) {
    throw new Error(getMissingLiveCredentialsMessage(role));
  }

  return credentials;
}

export function allowLiveMutations(): boolean {
  return process.env.LIVE_ALLOW_MUTATIONS === "1" && !isProductionBaseUrl(getLiveBaseUrl());
}
