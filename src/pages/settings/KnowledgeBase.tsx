import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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

export function KnowledgeBase() {
  const { t } = useTranslation();
  usePageTitle(t("settings.kb_title"));
  const { user } = useAuthStore();
  const { documents, addDocument, deleteDocument } = useDataStore();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const myDocuments = documents.filter((d) => d.userId === user.id);
  const totalSize = myDocuments.reduce((sum, d) => sum + d.size, 0);

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

  const handleDelete = (docId: string, docName: string) => {
    deleteDocument(docId);
    toast.success(`${docName} deleted`);
  };

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 50MB size limit`);
        return;
      }

      // Simulate upload and processing
      const newDoc = {
        id: `d${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "PROCESSING" as const,
        uploadedAt: new Date().toISOString(),
      };
      
      addDocument(newDoc);
      toast.info(`Uploading ${file.name}...`);
      
      // Simulate processing completion after 3 seconds
      setTimeout(() => {
        useDataStore.setState((state) => ({
          documents: state.documents.map((d) =>
            d.id === newDoc.id ? { ...d, status: "READY" } : d
          ),
        }));
        toast.success(`${file.name} processed successfully`);
      }, 3000);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          {t("settings.kb_header")}
        </h1>
        <p className="text-zinc-400">
          {t("settings.kb_header_desc")}
        </p>
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
            <div className="mb-4 rounded-full bg-zinc-800 p-4 border border-white/5">
              <UploadCloud className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="mb-1 text-lg font-medium text-zinc-100">
              {t("settings.click_drag")}
            </h3>
            <p className="text-sm text-zinc-500">
              {t("settings.kb_upload")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">{t("settings.kb_my_docs")}</CardTitle>
            <CardDescription className="text-zinc-400">
              {myDocuments.length} document{myDocuments.length !== 1 ? "s" : ""} • {formatSize(totalSize)} total
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {myDocuments.length > 0 ? (
            <div className="space-y-4">
              {myDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 border border-white/5">
                      <FileText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">{doc.name}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{formatSize(doc.size)}</span>
                        <span>•</span>
                        <span>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === "READY" && (
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready
                      </Badge>
                    )}
                    {doc.status === "PROCESSING" && (
                      <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-400 bg-amber-500/10">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing
                      </Badge>
                    )}
                    {doc.status === "FAILED" && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-400"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500">
              {t("settings.kb_no_docs")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
