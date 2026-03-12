"""
AI-World Knowledge Base Worker
Celery application for async file processing pipeline:
uploaded → parsing → chunking → embedding → ready
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery("aiworld-worker", broker=REDIS_URL, backend=REDIS_URL, include=["tasks.process_file"])

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
