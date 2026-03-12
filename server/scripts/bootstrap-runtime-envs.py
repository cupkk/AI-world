from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def serialize_env(values: dict[str, str]) -> str:
    def quote(value: str) -> str:
        needs_quotes = any(char.isspace() for char in value) or any(
            char in value for char in ['#', '<', '>', '"']
        )
        if not needs_quotes:
            return value
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'

    lines = [f"{key}={quote(value)}" for key, value in values.items()]
    return "\n".join(lines) + "\n"


def build_database_url(user: str, password: str, database: str) -> str:
    return f"postgresql://{user}:{password}@postgres:5432/{database}?schema=public"


def main() -> None:
    compose_env = parse_env(ROOT / ".env")
    app_env = parse_env(ROOT / ".env.local")

    postgres_user = compose_env.get("POSTGRES_USER", "aiworld")
    postgres_password = compose_env.get("POSTGRES_PASSWORD", "change-me")
    redis_url = compose_env.get("REDIS_URL", "redis://redis:6379")

    shared_keys = [
        "API_PORT",
        "SESSION_SECRET",
        "MAIL_FROM",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_SECURE",
        "SMTP_USER",
        "SMTP_PASS",
        "REQUIRE_SMTP",
        "OSS_REGION",
        "OSS_ENDPOINT",
        "OSS_BUCKET",
        "OSS_ACCESS_KEY_ID",
        "OSS_ACCESS_KEY_SECRET",
        "OSS_PUBLIC_BASE_URL",
        "REQUIRE_OSS",
        "UPLOAD_DIR",
        "KB_AV_SCAN_COMMAND",
        "KB_AV_SCAN_FAIL_OPEN",
        "KB_AV_SCAN_TIMEOUT_MS",
        "LLM_PROVIDER",
        "LLM_API_KEY",
        "LLM_CHAT_MODEL",
        "OPENAI_BASE_URL",
        "QWEN_BASE_URL",
        "EMBEDDING_MODEL",
        "REQUIRE_LLM",
        "LOG_LEVEL",
        "KB_QUEUE_NAME",
        "SENTRY_DSN",
        "SENTRY_TRACES_SAMPLE_RATE",
        "APP_VERSION",
    ]

    shared_values = {
        key: app_env[key]
        for key in shared_keys
        if key in app_env and app_env[key] != ""
    }

    production_db = compose_env.get("POSTGRES_DB", "aiworld")
    production = {
        "NODE_ENV": "production",
        **shared_values,
        "POSTGRES_USER": postgres_user,
        "POSTGRES_PASSWORD": postgres_password,
        "POSTGRES_DB": production_db,
        "DATABASE_URL": build_database_url(postgres_user, postgres_password, production_db),
        "REDIS_URL": redis_url,
        "CORS_ORIGIN": "https://ai-world.asia",
        "APP_URL": "https://ai-world.asia",
        "LOGIN_RATE_LIMIT_MAX": "5",
        "LOGIN_RATE_LIMIT_WINDOW_SECONDS": "60",
        "ENABLE_DEMO_INVITES": "false",
        "DEMO_INVITE_CODES": "",
        "ENABLE_PUBLIC_SAMPLE_INVITES": "true",
        "PUBLIC_SAMPLE_INVITES": "EXPERT:AIWORLD-EXPERT-2026,LEARNER:AIWORLD-LEARNER-2026,ENTERPRISE_LEADER:AIWORLD-ENTERPRISE-2026",
        "SEED_INCLUDE_DEMO_DATA": "false",
    }

    staging_db = "aiworld_staging"
    staging = {
        "NODE_ENV": "staging",
        **shared_values,
        "POSTGRES_USER": postgres_user,
        "POSTGRES_PASSWORD": postgres_password,
        "POSTGRES_DB": staging_db,
        "DATABASE_URL": build_database_url(postgres_user, postgres_password, staging_db),
        "REDIS_URL": redis_url,
        "CORS_ORIGIN": "https://staging.ai-world.asia",
        "APP_URL": "https://staging.ai-world.asia",
        "LOGIN_RATE_LIMIT_MAX": "20",
        "LOGIN_RATE_LIMIT_WINDOW_SECONDS": "60",
        "ENABLE_DEMO_INVITES": "false",
        "DEMO_INVITE_CODES": "",
        "ENABLE_PUBLIC_SAMPLE_INVITES": "true",
        "PUBLIC_SAMPLE_INVITES": "EXPERT:AIWORLD-EXPERT-2026,LEARNER:AIWORLD-LEARNER-2026,ENTERPRISE_LEADER:AIWORLD-ENTERPRISE-2026",
        "SEED_INCLUDE_DEMO_DATA": "false",
    }

    (ROOT / ".env.production").write_text(serialize_env(production), encoding="utf-8")
    (ROOT / ".env.staging").write_text(serialize_env(staging), encoding="utf-8")


if __name__ == "__main__":
    main()
