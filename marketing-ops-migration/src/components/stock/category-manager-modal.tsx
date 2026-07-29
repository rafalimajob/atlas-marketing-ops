"use client";

import { useState, FormEvent } from "react";
import { Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CategoryDTO } from "@/types/category";

export function CategoryManagerModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: CategoryDTO[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<CategoryDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cadastrar a categoria.");
      setNewName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: CategoryDTO) {
    setEditingId(category.id);
    setEditingName(category.name);
    setError(null);
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível renomear a categoria.");
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  async function confirmDelete() {
    const category = confirmDeleteTarget;
    if (!category) return;
    setError(null);
    setDeletingId(category.id);
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir a categoria.");
      onChanged();
      setConfirmDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal title="Gerenciar categorias" onClose={onClose}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <Input
            label="Nova categoria"
            placeholder="Ex.: Camisetas"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !newName.trim()}>
            Adicionar
          </Button>
        </form>

        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <button type="button" onClick={() => handleRename(c.id)} className="text-brand-ok hover:opacity-70">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-zinc-400 hover:opacity-70">
                    <XIcon size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-100">{c.name}</span>
                  <button type="button" onClick={() => startEdit(c)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmDeleteTarget(c);
                    }}
                    disabled={deletingId === c.id}
                    className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
          {categories.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma categoria cadastrada.</p>}
        </ul>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir categoria"
          message={`Excluir a categoria "${confirmDeleteTarget.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          loading={deletingId === confirmDeleteTarget.id}
          error={error}
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirmDeleteTarget(null);
            setError(null);
          }}
        />
      )}
    </Modal>
  );
}
