"""
Knowledge Base file processing pipeline.
uploaded → parsing → embedding → ready
"""
import json
import logging
import os
import tempfile
from typing import List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg2
from celery import shared_task

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1").rstrip("/")
NODE_ENV = os.getenv("NODE_ENV", "development")
REQUIRE_LLM = os.getenv("REQUIRE_LLM", "").strip().lower() in {"1", "true", "yes", "on"} or NODE_ENV == "production"

CHUNK_SIZE = 500  # tokens
CHUNK_OVERLAP = 50


def format_error(exc: Exception) -> str:
    text = str(exc).strip() or exc.__class__.__name__
    if len(text) > 500:
        return text[:497] + "..."
    return text


def validate_runtime_config() -> None:
    missing = []
    if not DATABASE_URL:
        missing.append("DATABASE_URL")
    if REQUIRE_LLM and not LLM_API_KEY:
        missing.append("LLM_API_KEY")
    if missing:
        raise RuntimeError(
            "Worker is missing required configuration: " + ", ".join(missing)
        )


def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(_get_psycopg2_dsn(DATABASE_URL))


def _get_psycopg2_dsn(database_url: str) -> str:
    """Strip Prisma-only URI params that psycopg2 rejects."""
    parts = urlsplit(database_url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "schema"]
    if len(query) == len(parse_qsl(parts.query, keep_blank_values=True)):
        return database_url
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def update_file_status(file_id: str, status: str, error_message: str = None):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if error_message:
            cur.execute(
                "UPDATE kb_files SET status = %s, error_message = %s, updated_at = NOW() WHERE id = %s",
                (status, format_error(Exception(error_message)), file_id),
            )
        else:
            cur.execute(
                "UPDATE kb_files SET status = %s, error_message = NULL, updated_at = NOW() WHERE id = %s",
                (status, file_id),
            )
        conn.commit()
    finally:
        conn.close()


def parse_file(storage_key: str, file_name: str, mime_type: str, local_path: Optional[str] = None) -> str:
    """Extract text from file. Reads local storage directly or downloads from OSS."""
    logger.info("Parsing file: %s (%s)", file_name, mime_type)

    resolved_local_path = local_path or storage_key
    oss_bucket = os.getenv("OSS_BUCKET", "")
    downloaded_from_oss = False

    if oss_bucket and not (local_path and os.path.exists(local_path)):
        resolved_local_path = _download_from_oss(storage_key)
        downloaded_from_oss = True

    if not os.path.exists(resolved_local_path):
        raise FileNotFoundError(f"File not found: {resolved_local_path}")

    try:
        text = _extract_text(resolved_local_path, file_name, mime_type)
    finally:
        if downloaded_from_oss and resolved_local_path.startswith(tempfile.gettempdir()):
            try:
                os.remove(resolved_local_path)
            except OSError:
                pass

    if not text or not text.strip():
        raise ValueError(f"No text extracted from {file_name}")

    logger.info("Extracted %s characters from %s", len(text), file_name)
    return text


def _download_from_oss(oss_key: str) -> str:
    """Download file from Alibaba Cloud OSS to a temporary local path."""
    import urllib.request
    import hashlib
    import hmac
    from email.utils import formatdate

    bucket = os.getenv("OSS_BUCKET", "")
    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-shanghai.aliyuncs.com")
    access_key_id = os.getenv("OSS_ACCESS_KEY_ID", "")
    access_key_secret = os.getenv("OSS_ACCESS_KEY_SECRET", "")

    if not bucket or not access_key_id or not access_key_secret:
        raise RuntimeError("OSS is enabled but bucket credentials are incomplete")

    url = f"https://{bucket}.{endpoint}/{oss_key}"
    date_str = formatdate(usegmt=True)

    # Sign the request
    string_to_sign = f"GET\n\n\n{date_str}\n/{bucket}/{oss_key}"
    signature = hmac.new(
        access_key_secret.encode(), string_to_sign.encode(), hashlib.sha1
    ).digest()
    import base64
    sig_b64 = base64.b64encode(signature).decode()

    req = urllib.request.Request(url, headers={
        "Date": date_str,
        "Authorization": f"OSS {access_key_id}:{sig_b64}",
    })

    ext = os.path.splitext(oss_key)[1]
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=ext)
    file_handle = None
    try:
        file_handle = os.fdopen(tmp_fd, 'wb')
        with urllib.request.urlopen(req) as resp, file_handle as f:
            while True:
                chunk = resp.read(8192)
                if not chunk:
                    break
                f.write(chunk)
    except Exception:
        if file_handle is None:
            os.close(tmp_fd)
        raise

    logger.info(f"Downloaded OSS file to {tmp_path}")
    return tmp_path


def _extract_text(file_path: str, file_name: str, mime_type: str) -> str:
    """Extract text content based on file type."""
    ext = os.path.splitext(file_name)[1].lower()

    if ext == ".pdf" or mime_type == "application/pdf":
        return _parse_pdf(file_path)
    elif ext in (".doc", ".docx") or mime_type in (
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        return _parse_docx(file_path)
    elif ext in (".ppt", ".pptx") or mime_type in (
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ):
        return _parse_pptx(file_path)
    elif ext == ".txt" or mime_type.startswith("text/"):
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    else:
        # Fallback: try unstructured
        return _parse_unstructured(file_path)


def _parse_pdf(file_path: str) -> str:
    """Extract text from PDF using PyPDF2."""
    from PyPDF2 import PdfReader

    reader = PdfReader(file_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def _parse_docx(file_path: str) -> str:
    """Extract text from Word documents."""
    from docx import Document

    doc = Document(file_path)
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)


def _parse_pptx(file_path: str) -> str:
    """Extract text from PowerPoint files using unstructured."""
    return _parse_unstructured(file_path)


def _parse_unstructured(file_path: str) -> str:
    """Fallback parser using unstructured library."""
    try:
        from unstructured.partition.auto import partition

        elements = partition(filename=file_path)
        return "\n\n".join(str(el) for el in elements if str(el).strip())
    except ImportError:
        logger.warning("unstructured library not available, cannot parse file")
        raise ValueError(f"Cannot parse file: unstructured library not installed")
    except Exception as e:
        logger.error(f"unstructured parsing failed: {e}")
        raise


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks if chunks else [text]


def get_embedding(text: str) -> List[float]:
    """Get embedding vector from LLM provider."""
    import urllib.request
    from urllib.error import HTTPError, URLError

    if not LLM_API_KEY:
        raise RuntimeError(f"LLM_API_KEY is not configured for provider {LLM_PROVIDER}")

    if LLM_PROVIDER == "openai":
        url = f"{OPENAI_BASE_URL}/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}",
        }
        data = json.dumps({"model": EMBEDDING_MODEL, "input": text}).encode()
    elif LLM_PROVIDER == "qwen":
        url = f"{QWEN_BASE_URL}/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}",
        }
        data = json.dumps({"model": EMBEDDING_MODEL or "text-embedding-v2", "input": text}).encode()
    else:
        raise ValueError(f"Unsupported LLM provider: {LLM_PROVIDER}")

    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return result["data"][0]["embedding"]
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace").strip()
        detail = f"Embedding request failed for {LLM_PROVIDER} ({url}): HTTP {exc.code}"
        if body:
            detail = f"{detail} - {body[:200]}"
        raise RuntimeError(detail) from exc
    except URLError as exc:
        raise RuntimeError(f"Embedding request failed for {LLM_PROVIDER} ({url}): {exc.reason}") from exc


def process_kb_file_sync(
    file_id: str,
    storage_key: str,
    user_id: str,
    file_name: str,
    mime_type: str,
    local_path: Optional[str] = None,
):
    """Main processing pipeline for a knowledge base file."""
    validate_runtime_config()
    try:
        update_file_status(file_id, "parsing")
        text = parse_file(storage_key, file_name, mime_type, local_path=local_path)

        chunks = chunk_text(text)
        logger.info("File %s: %s chunks created", file_id, len(chunks))

        update_file_status(file_id, "embedded")
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM kb_chunks WHERE kb_file_id = %s", (file_id,))
            for i, chunk_text_content in enumerate(chunks):
                embedding = get_embedding(chunk_text_content)
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

                cur.execute(
                    """
                    INSERT INTO kb_chunks (id, kb_file_id, owner_user_id, chunk_index, text, embedding, created_at)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s::vector, NOW())
                    """,
                    (file_id, user_id, i, chunk_text_content, embedding_str),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

        update_file_status(file_id, "ready")
        logger.info("File %s processing complete: %s chunks embedded", file_id, len(chunks))

    except Exception as exc:
        logger.error("File %s processing failed: %s", file_id, exc)
        update_file_status(file_id, "failed", format_error(exc))
        raise


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_kb_file(self, file_id: str, storage_key: str, user_id: str, file_name: str, mime_type: str, local_path: Optional[str] = None):
    """Celery-compatible wrapper kept for manual task triggering."""
    try:
        process_kb_file_sync(
            file_id=file_id,
            storage_key=storage_key,
            user_id=user_id,
            file_name=file_name,
            mime_type=mime_type,
            local_path=local_path,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
