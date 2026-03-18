from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent


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


def pick_env_value(
    key: str,
    *sources: dict[str, str],
    default: str = "",
) -> str:
    env_value = os.environ.get(key)
    if env_value is not None and env_value != "":
        return env_value

    for source in sources:
        value = source.get(key)
        if value is not None and value != "":
            return value

    return default


def main() -> None:
    compose_env = parse_env(ROOT / ".env")
    app_env = parse_env(ROOT / ".env.local")
    existing_production_env = parse_env(ROOT / ".env.production")
    existing_frontend_production_env = parse_env(PROJECT_ROOT / ".env.production")

    postgres_user = pick_env_value(
        "POSTGRES_USER",
        compose_env,
        existing_production_env,
        default="aiworld",
    )
    postgres_password = pick_env_value(
        "POSTGRES_PASSWORD",
        compose_env,
        existing_production_env,
        default="change-me",
    )
    redis_url = pick_env_value(
        "REDIS_URL",
        compose_env,
        existing_production_env,
        default="redis://redis:6379",
    )

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
        key: pick_env_value(key, app_env, existing_production_env)
        for key in shared_keys
        if pick_env_value(key, app_env, existing_production_env) != ""
    }

    enable_assistant = pick_env_value(
        "ENABLE_ASSISTANT",
        app_env,
        existing_production_env,
        default="false",
    )
    enable_knowledge_base = pick_env_value(
        "ENABLE_KNOWLEDGE_BASE",
        app_env,
        existing_production_env,
        default="false",
    )

    production_db = pick_env_value(
        "POSTGRES_DB",
        compose_env,
        existing_production_env,
        default="aiworld",
    )
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
        "ENABLE_PUBLIC_SAMPLE_INVITES": "false",
        "PUBLIC_SAMPLE_INVITES": "",
        "ENABLE_ASSISTANT": enable_assistant,
        "ENABLE_KNOWLEDGE_BASE": enable_knowledge_base,
        "SEED_INCLUDE_DEMO_DATA": "false",
    }

    frontend_production = {
        "VITE_API_BASE_URL": pick_env_value(
            "VITE_API_BASE_URL",
            app_env,
            existing_frontend_production_env,
            default="",
        ),
        "VITE_ENABLE_DEMO_MODE": "false",
        "VITE_ALLOW_DEMO_PREFILL": "false",
        "VITE_ENABLE_PUBLIC_SAMPLE_INVITES": "false",
        "VITE_ENABLE_ASSISTANT": pick_env_value(
            "VITE_ENABLE_ASSISTANT",
            app_env,
            default=enable_assistant,
        ),
        "VITE_ENABLE_KNOWLEDGE_BASE": pick_env_value(
            "VITE_ENABLE_KNOWLEDGE_BASE",
            app_env,
            default=enable_knowledge_base,
        ),
    }

    (ROOT / ".env.production").write_text(
        serialize_env(production), encoding="utf-8"
    )
    (PROJECT_ROOT / ".env.production").write_text(
        serialize_env(frontend_production), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
