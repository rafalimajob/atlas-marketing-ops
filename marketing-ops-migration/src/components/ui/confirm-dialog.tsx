"use client";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Sim",
  cancelLabel = "Não",
  onConfirm,
  onCancel,
  loading,
  danger,
  error,
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        {children && <div className="mt-3">{children}</div>}
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading || confirmDisabled}>
            {loading ? "Confirmando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
