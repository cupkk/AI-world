import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import {
  uploadKnowledgeBaseFile,
  fetchKnowledgeBaseFilesApi,
  deleteKnowledgeBaseFileByApi,
} from "../../lib/api";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/ui/StateDisplay";
import type { KnowledgeDocument } from "../../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "../../hooks/useTranslation";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];
const TEMP_DOCUMENT_PREFIX = "temp_";

function isTemporaryDocument(doc: KnowledgeDocument) {
  return doc.id.startsWith(TEMP_DOCUMENT_PREFIX);
}

function matchesUploadedDocument(
  localDoc: KnowledgeDocument,
  remoteDoc: KnowledgeDocument,
) {
  return (
    localDoc.name === remoteDoc.name &&
    localDoc.size === remoteDoc.size &&
    localDoc.type === remoteDoc.type
  );
}

function mergeKnowledgeDocuments(
  existing: KnowledgeDocument[],
  remote: KnowledgeDocument[],
) {
  const pendingTemporaryDocs = existing.filter(
    (doc) =>
      isTemporaryDocument(doc) &&
      !remote.some((remoteDoc) => matchesUploadedDocument(doc, remoteDoc)),
  );

  return [...pendingTemporaryDocs, ...remote];
}

export function KnowledgeBase() {
  const { t } = useTranslation();
  usePageTitle(t("settings.kb_title"));
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  const setIfMounted = (callback: () => void) => {
    if (!isMountedRef.current) return;
    callback();
  };

  const loadFiles = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIfMounted(() => {
        setLoading(true);
        setHasLoadError(false);
      });
    }

    try {
      const files = await fetchKnowledgeBaseFilesApi();
      setIfMounted(() => {
        setDocuments((prev) => mergeKnowledgeDocuments(prev, files));
        setHasSyncError(false);
      });
    } catch {
      setIfMounted(() => {
        if (silent) {
          setHasSyncError(true);
          return;
        }

        setDocuments([]);
        setHasLoadError(true);
      });
    } finally {
      if (!silent) {
        setIfMounted(() => setLoading(false));
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void loadFiles();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some((doc) => doc.status === "PROCESSING");
    if (!hasProcessing) {
      setHasSyncError(false);
      return;
    }

    const timer = window.setInterval(() => {
      void loadFiles({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [documents]);

  if (!user) return null;

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    try {
      await deleteKnowledgeBaseFileByApi(docId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      toast.success(`${docName} ${t("settings.kb_deleted")}`);
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      toast.error(`${file.name} ${t("settings.kb_unsupported_type")}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} ${t("settings.kb_exceeds_size")}`);
      return;
    }

    const tempId = `${TEMP_DOCUMENT_PREFIX}${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    const tempDoc: KnowledgeDocument = {
      id: tempId,
      userId: user.id,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "PROCESSING",
      errorMessage: undefined,
      uploadedAt: new Date().toISOString(),
    };

    setHasLoadError(false);
    setHasSyncError(false);
    setDocuments((prev) => [tempDoc, ...prev]);
    toast.info(`${t("settings.kb_uploading")} ${file.name}...`);

    try {
      const result = await uploadKnowledgeBaseFile(file);
      const nextStatus = result.status ?? "PROCESSING";
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId
            ? {
                id: result.id ?? tempId,
                userId: user.id,
                name: result.name ?? file.name,
                size: result.size ?? file.size,
                type: result.type ?? file.type,
                status: nextStatus,
                errorMessage: result.errorMessage,
                uploadedAt: result.uploadedAt ?? tempDoc.uploadedAt,
              }
            : doc,
        ),
      );

      if (nextStatus === "FAILED") {
        toast.error(`${file.name} ${t("settings.kb_upload_failed")}`);
      } else if (nextStatus === "READY") {
        toast.success(`${file.name} ${t("settings.kb_processed_success")}`);
      } else {
        toast.info(`${file.name} ${t("settings.kb_processing")}`);
      }
    } catch {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId
            ? {
                ...doc,
                status: "FAILED" as const,
                errorMessage: t("settings.kb_upload_failed"),
              }
            : doc,
        ),
      );
      toast.error(`${file.name} ${t("settings.kb_upload_failed")}`);
    }
  };

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      void processFile(file);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          {t("settings.kb_header")}
        </h1>
        <p className="text-zinc-400">{t("settings.kb_header_desc")}</p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.kb_upload")}</CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.kb_upload_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              onChange={handleFileInput}
            />
            <div className="mb-4 rounded-full border border-white/5 bg-zinc-800 p-4">
              <UploadCloud className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="mb-1 text-lg font-medium text-zinc-100">
              {t("settings.click_drag")}
            </h3>
            <p className="text-sm text-zinc-500">{t("settings.kb_upload")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">{t("settings.kb_my_docs")}</CardTitle>
            <CardDescription className="text-zinc-400">
              {documents.length} {documents.length !== 1 ? t("settings.kb_documents") : t("settings.kb_document")} {" | "}
              {formatSize(totalSize)} {t("settings.kb_total")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton rows={2} />
          ) : hasLoadError ? (
            <ErrorState
              title={t("settings.kb_load_error_title")}
              description={t("settings.kb_load_error_desc")}
              onRetry={() => {
                void loadFiles();
              }}
            />
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {hasSyncError && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {t("settings.kb_sync_warning")}
                </div>
              )}
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-zinc-800">
                      <FileText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">{doc.name}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{formatSize(doc.size)}</span>
                        <span>|</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      {doc.status === "FAILED" && doc.errorMessage && (
                        <p className="mt-1 text-xs text-red-300">{doc.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === "READY" && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {t("settings.kb_ready")}
                      </Badge>
                    )}
                    {doc.status === "PROCESSING" && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400"
                      >
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("settings.kb_processing")}
                      </Badge>
                    )}
                    {doc.status === "FAILED" && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t("settings.kb_failed")}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-400"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      title={t("settings.kb_delete_document")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-zinc-500" />}
              title={t("settings.kb_no_docs")}
              description={t("settings.kb_empty_desc")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
