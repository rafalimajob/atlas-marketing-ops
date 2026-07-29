"use client";

import { useState, FormEvent } from "react";
import { Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AreaDTO } from "@/types/area";

export function AreaManagerModal({
  areas,
  onClose,
  onChanged,
}: {
  areas: AreaDTO[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<AreaDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cadastrar a área.");
      setNewName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(area: AreaDTO) {
    setEditingId(area.id);
    setEditingName(area.name);
    setError(null);
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await fetch(`/api/areas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível renomear a área.");
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  async function confirmDelete() {
    const area = confirmDeleteTarget;
    if (!area) return;
    setError(null);
    setDeletingId(area.id);
    try {
      const res = await fetch(`/api/areas/${area.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir a área.");
      onChanged();
      setConfirmDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal title="Gerenciar áreas" onClose={onClose}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <Input
            label="Nova área"
            placeholder="Ex.: Recursos Humanos"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !newName.trim()}>
            Adicionar
          </Button>
        </form>

        <ul className="space-y-1.5">
          {areas.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              {editingId === a.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <button type="button" onClick={() => handleRename(a.id)} className="text-brand-ok hover:opacity-70">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-zinc-400 hover:opacity-70">
                    <XIcon size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-100">{a.name}</span>
                  <button type="button" onClick={() => startEdit(a)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTarget(a)}
                    disabled={deletingId === a.id}
                    className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
          {areas.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma área cadastrada.</p>}
        </ul>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir área"
          message={`Excluir a área "${confirmDeleteTarget.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          loading={deletingId === confirmDeleteTarget.id}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteTarget(null)}
        />
      )}
    </Modal>
  );
}
