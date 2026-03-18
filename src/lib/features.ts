function parseFeatureFlag(
  value: string | boolean | undefined,
  defaultValue: boolean,
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return defaultValue;
  }
}

const defaultEnabled = import.meta.env.DEV;

export const featureFlags = {
  assistant: parseFeatureFlag(
    import.meta.env.VITE_ENABLE_ASSISTANT,
    defaultEnabled,
  ),
  knowledgeBase: parseFeatureFlag(
    import.meta.env.VITE_ENABLE_KNOWLEDGE_BASE,
    defaultEnabled,
  ),
  publicInviteSamples: parseFeatureFlag(
    import.meta.env.VITE_ENABLE_PUBLIC_SAMPLE_INVITES,
    defaultEnabled,
  ),
} as const;
