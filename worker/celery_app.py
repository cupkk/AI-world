"""
AI-World Knowledge Base Worker

The backend enqueues jobs into a Redis list (`kb:process-queue`), so the worker
must consume the same queue instead of waiting for Celery task messages.
"""
import json
import logging
import os
import signal
import time
from typing import Any, Dict

from dotenv import load_dotenv
from redis import Redis
from redis.exceptions import RedisError

from tasks.process_file import process_kb_file_sync, update_file_status, validate_runtime_config

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("aiworld.worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
KB_QUEUE_NAME = os.getenv("KB_QUEUE_NAME", "kb:process-queue")
POLL_TIMEOUT_SECONDS = 5

_running = True


def _handle_signal(signum: int, _frame: Any) -> None:
    global _running
    logger.info("Received signal %s, shutting down worker loop", signum)
    _running = False


def _process_payload(payload: Dict[str, Any]) -> None:
    file_id = payload["fileId"]
    storage_key = payload.get("storageKey") or payload.get("ossKey") or payload.get("localPath")
    user_id = payload["userId"]
    file_name = payload["fileName"]
    mime_type = payload.get("mimeType") or "application/octet-stream"
    local_path = payload.get("localPath")

    if not storage_key:
        raise ValueError("Queue payload missing storageKey/localPath")

    process_kb_file_sync(
        file_id=file_id,
        storage_key=storage_key,
        user_id=user_id,
        file_name=file_name,
        mime_type=mime_type,
        local_path=local_path,
    )


def main() -> int:
    validate_runtime_config()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    logger.info("Knowledge-base worker listening on queue %s", KB_QUEUE_NAME)

    while _running:
        payload: Dict[str, Any] = {}
        try:
            item = redis_client.brpop(KB_QUEUE_NAME, timeout=POLL_TIMEOUT_SECONDS)
            if not item:
                continue

            _, raw_payload = item
            payload = json.loads(raw_payload)
            _process_payload(payload)
        except RedisError:
            logger.exception("Redis worker loop failed; retrying")
            time.sleep(3)
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received, stopping worker")
            break
        except Exception as exc:
            logger.exception("Knowledge-base job failed")
            file_id = payload.get("fileId")
            if file_id:
                update_file_status(file_id, "failed", str(exc))

    try:
        redis_client.close()
    except Exception:
        pass

    logger.info("Knowledge-base worker stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
