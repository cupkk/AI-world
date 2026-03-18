import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = item.slice(2).split("=", 2);
    if (rawValue !== undefined) {
      args[rawKey] = rawValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[rawKey] = next;
      index += 1;
      continue;
    }

    args[rawKey] = "true";
  }

  return args;
}

function findFirstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const absolutePath = path.resolve(candidate);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function parseEnvFile(filePath) {
  const result = {};
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function normalizeBoolean(value) {
  if (typeof value !== "string") {
    return null;
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
      return null;
  }
}

function isPlaceholder(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    "replace-me",
    "replace-with-a-long-random-secret",
    "change-me",
    "change-this-to-a-random-64-char-string-in-production",
    "user:pass",
    "smtp.provider.com",
    "postgresql://user:pass@postgres:5432/aiworld?schema=public",
    "postgresql://user:pass@postgres:5432/aiworld_staging?schema=public",
  ].some((token) => normalized.includes(token));
}

function createReporter() {
  const passed = [];
  const warnings = [];
  const failures = [];

  return {
    passed,
    warnings,
    failures,
    pass(message) {
      passed.push(message);
    },
    warn(message) {
      warnings.push(message);
    },
    fail(message) {
      failures.push(message);
    },
  };
}

function expectBoolean(env, key, expected, reporter, label = key) {
  const normalized = normalizeBoolean(env[key]);
  if (normalized === null) {
    reporter.fail(`${label} must be explicitly set to true or false.`);
    return null;
  }

  if (normalized !== expected) {
    reporter.fail(`${label} must be ${expected}.`);
    return normalized;
  }

  reporter.pass(`${label}=${expected}`);
  return normalized;
}

function readBoolean(env, key, reporter, label = key) {
  const normalized = normalizeBoolean(env[key]);
  if (normalized === null) {
    reporter.fail(`${label} must be explicitly set to true or false.`);
    return null;
  }

  reporter.pass(`${label}=${normalized}`);
  return normalized;
}

function expectExact(env, key, expected, reporter, label = key) {
  if ((env[key] ?? "").trim() !== expected) {
    reporter.fail(`${label} must be ${expected}.`);
    return;
  }

  reporter.pass(`${label}=${expected}`);
}

function expectNonEmpty(env, key, reporter, options = {}) {
  const value = (env[key] ?? "").trim();
  const label = options.label ?? key;

  if (!value) {
    reporter.fail(`${label} must be set.`);
    return;
  }

  if (options.rejectPlaceholders && isPlaceholder(value)) {
    reporter.fail(`${label} must not use a placeholder value.`);
    return;
  }

  reporter.pass(`${label} is set`);
}

function expectMatchingFlag(leftValue, rightValue, label, reporter) {
  if (leftValue === null || rightValue === null) {
    return;
  }

  if (leftValue !== rightValue) {
    reporter.fail(`${label} must match on frontend and backend.`);
    return;
  }

  reporter.pass(`${label} matches`);
}

const args = parseArgs(process.argv.slice(2));
const mode = args.mode === "staging" ? "staging" : "production";
const frontendFile = findFirstExistingFile([
  args["frontend-file"],
  `.env.${mode}`,
  `.env.${mode}.local`,
  `.env.${mode}.example`,
]);
const backendFile = findFirstExistingFile([
  args["backend-file"],
  `server/.env.${mode}`,
  `server/.env.${mode}.local`,
  `server/.env.${mode}.example`,
]);

if (!frontendFile || !backendFile) {
  console.error("release-preflight: could not locate both frontend and backend env files.");
  process.exit(1);
}

const reporter = createReporter();
const frontendEnv = parseEnvFile(frontendFile);
const backendEnv = parseEnvFile(backendFile);
const frontendIsExample = frontendFile.endsWith(".example");
const backendIsExample = backendFile.endsWith(".example");

console.log(`release-preflight mode: ${mode}`);
console.log(`frontend env: ${path.relative(process.cwd(), frontendFile)}`);
console.log(`backend env: ${path.relative(process.cwd(), backendFile)}`);

if (frontendIsExample || backendIsExample) {
  reporter.warn(
    "Example env file detected. Secret placeholder checks are skipped until you point the script at real release env files.",
  );
}

expectBoolean(
  frontendEnv,
  "VITE_ENABLE_DEMO_MODE",
  false,
  reporter,
  "frontend demo mode",
);
expectBoolean(
  frontendEnv,
  "VITE_ALLOW_DEMO_PREFILL",
  false,
  reporter,
  "frontend demo prefill",
);
const frontendAssistant = readBoolean(
  frontendEnv,
  "VITE_ENABLE_ASSISTANT",
  reporter,
  "frontend assistant flag",
);
const frontendKnowledgeBase = readBoolean(
  frontendEnv,
  "VITE_ENABLE_KNOWLEDGE_BASE",
  reporter,
  "frontend knowledge base flag",
);
expectBoolean(
  frontendEnv,
  "VITE_ENABLE_PUBLIC_SAMPLE_INVITES",
  false,
  reporter,
  "frontend public sample invites",
);

expectExact(backendEnv, "NODE_ENV", mode, reporter, "backend NODE_ENV");
expectBoolean(
  backendEnv,
  "ENABLE_DEMO_INVITES",
  false,
  reporter,
  "backend demo invites",
);
expectBoolean(
  backendEnv,
  "SEED_INCLUDE_DEMO_DATA",
  false,
  reporter,
  "backend demo seed data",
);
expectBoolean(
  backendEnv,
  "ENABLE_PUBLIC_SAMPLE_INVITES",
  false,
  reporter,
  "backend public sample invites",
);
expectBoolean(
  backendEnv,
  "REQUIRE_SMTP",
  true,
  reporter,
  "backend REQUIRE_SMTP",
);
expectBoolean(
  backendEnv,
  "REQUIRE_OSS",
  true,
  reporter,
  "backend REQUIRE_OSS",
);

const backendAssistant = readBoolean(
  backendEnv,
  "ENABLE_ASSISTANT",
  reporter,
  "backend assistant flag",
);
const backendKnowledgeBase = readBoolean(
  backendEnv,
  "ENABLE_KNOWLEDGE_BASE",
  reporter,
  "backend knowledge base flag",
);

expectMatchingFlag(
  frontendAssistant,
  backendAssistant,
  "assistant feature flag",
  reporter,
);
expectMatchingFlag(
  frontendKnowledgeBase,
  backendKnowledgeBase,
  "knowledge base feature flag",
  reporter,
);

if (!backendIsExample) {
  expectNonEmpty(backendEnv, "DATABASE_URL", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "REDIS_URL", reporter);
  expectNonEmpty(backendEnv, "SESSION_SECRET", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "CORS_ORIGIN", reporter);
  expectNonEmpty(backendEnv, "APP_URL", reporter);
  expectNonEmpty(backendEnv, "MAIL_FROM", reporter);
  expectNonEmpty(backendEnv, "SMTP_HOST", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "SMTP_USER", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "SMTP_PASS", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "OSS_REGION", reporter);
  expectNonEmpty(backendEnv, "OSS_ENDPOINT", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "OSS_BUCKET", reporter);
  expectNonEmpty(backendEnv, "OSS_ACCESS_KEY_ID", reporter, {
    rejectPlaceholders: true,
  });
  expectNonEmpty(backendEnv, "OSS_ACCESS_KEY_SECRET", reporter, {
    rejectPlaceholders: true,
  });
}

if (backendAssistant) {
  expectBoolean(
    backendEnv,
    "REQUIRE_LLM",
    true,
    reporter,
    "backend REQUIRE_LLM",
  );

  if (!backendIsExample) {
    expectNonEmpty(backendEnv, "LLM_API_KEY", reporter, {
      rejectPlaceholders: true,
    });
    expectNonEmpty(backendEnv, "LLM_CHAT_MODEL", reporter);
  }
} else {
  reporter.pass("assistant is sealed for this release profile");
}

if (backendKnowledgeBase) {
  expectNonEmpty(backendEnv, "KB_UPLOAD_DIR", reporter);
} else {
  reporter.pass("knowledge base is sealed for this release profile");
}

if (reporter.failures.length > 0) {
  console.error("\nFAIL");
  for (const failure of reporter.failures) {
    console.error(`- ${failure}`);
  }
}

if (reporter.warnings.length > 0) {
  console.log("\nWARN");
  for (const warning of reporter.warnings) {
    console.log(`- ${warning}`);
  }
}

console.log("\nOK");
for (const passed of reporter.passed) {
  console.log(`- ${passed}`);
}

process.exit(reporter.failures.length > 0 ? 1 : 0);
