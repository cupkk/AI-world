type LiveRole = "ADMIN" | "LEARNER" | "EXPERT" | "ENTERPRISE";

function getProductionBaseUrl(): string {
  return (process.env.PRODUCTION_BASE_URL || "https://ai-world.asia").trim();
}

export function getLiveBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL?.trim() || getProductionBaseUrl();
}

export function isProductionBaseUrl(url: string): boolean {
  return url.replace(/\/$/, "") === getProductionBaseUrl().replace(/\/$/, "");
}

function getCredentialEnvKeys(role: LiveRole) {
  return {
    emailKeys: [`LIVE_${role}_EMAIL`],
    passwordKeys: [`LIVE_${role}_PASSWORD`],
  };
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

export function isLiveFeatureEnabled(
  feature: "ASSISTANT" | "KNOWLEDGE_BASE",
): boolean {
  const raw = process.env[`LIVE_ENABLE_${feature}`]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
