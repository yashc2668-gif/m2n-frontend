import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/cn";

interface UploadProgressProps {
  /** 0–100 progress. `null` = idle state. */
  progress: number | null;
  /** File name being uploaded */
  fileName?: string;
  /** Called when user hits cancel */
  onCancel?: () => void;
}

export function UploadProgress({
  progress,
  fileName,
  onCancel,
}: UploadProgressProps) {
  if (progress === null) return null;

  const done = progress >= 100;

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/90 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {fileName ? (
            <p className="truncate text-sm font-semibold text-[var(--surface-ink)]">
              {fileName}
            </p>
          ) : null}
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                done ? "bg-emerald-500" : "bg-[var(--accent)]",
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--surface-faint)]">
            {done ? "Upload complete" : `${Math.round(progress)}% uploaded`}
          </p>
        </div>
        {!done && onCancel ? (
          <button
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--danger)] transition hover:bg-orange-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Hook for XHR upload with progress tracking ──────────────── */

interface UseUploadProgressReturn {
  progress: number | null;
  fileName: string | null;
  isUploading: boolean;
  upload: (url: string, formData: FormData, token: string) => Promise<Response>;
  cancel: () => void;
  reset: () => void;
}

export function useUploadProgress(): UseUploadProgressReturn {
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const upload = useCallback(
    (url: string, formData: FormData, token: string): Promise<Response> => {
      // Extract file name from FormData
      const file = formData.get("file");
      if (file instanceof File) {
        setFileName(file.name);
      }
      setProgress(0);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          setProgress(100);
          xhrRef.current = null;
          // Convert XHR to Response-like for consistency
          const resp = new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          });
          resolve(resp);
        });

        xhr.addEventListener("error", () => {
          xhrRef.current = null;
          reject(new Error("Upload failed"));
        });

        xhr.addEventListener("abort", () => {
          xhrRef.current = null;
          reject(new Error("Upload cancelled"));
        });

        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    setProgress(null);
    setFileName(null);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setFileName(null);
  }, []);

  return {
    progress,
    fileName,
    isUploading: progress !== null && progress < 100,
    upload,
    cancel,
    reset,
  };
}
