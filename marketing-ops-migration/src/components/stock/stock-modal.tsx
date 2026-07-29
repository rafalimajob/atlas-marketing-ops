"use client";

import { useState, FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SaveButton, type SaveStatus } from "@/components/ui/save-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { StockItemDTO, StockItemFormValues } from "@/types/stock";
import type { CategoryDTO } from "@/types/category";

function toFormValues(item?: StockItemDTO, defaultCategory = ""): StockItemFormValues {
  return {
    name: item?.name ?? "",
    category: item?.category ?? defaultCategory,
    quantity: item?.quantity ?? 0,
    minStock: item?.minStock ?? 0,
    idealStock: item?.idealStock ?? 0,
    lastCost: item?.lastCost ?? "",
    lastPurchaseDate: item?.lastPurchaseDate ? item.lastPurchaseDate.slice(0, 10) : "",
    location: item?.location ?? "",
  };
}

export function StockModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item?: StockItemDTO;
  categories: CategoryDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StockItemFormValues>(() => toFormValues(item, categories[0]?.name ?? ""));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Item antigo pode ter uma categoria que foi renomeada/excluída do cadastro
  // gerenciado depois — mantém o valor atual selecionável em vez de trocá-lo
  // silenciosamente pela primeira opção da lista.
  const categoryMissing = form.category !== "" && !categories.some((c) => c.name === form.category);

  function set<K extends keyof StockItemFormValues>(key: K, value: StockItemFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(item ? `/api/stock/${item.id}` : "/api/stock", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar o item.");
      onSaved();
      setStatus("success");
      setTimeout(onClose, 550);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setStatus("idle");
    }
  }

  return (
    <Modal title={item ? "Editar item de estoque" : "Novo item de estoque"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />

          <Select
            label="Categoria"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            required
          >
            {categories.length === 0 && !categoryMissing && (
              <option value="" disabled>
                Nenhuma categoria cadastrada
              </option>
            )}
            {categoryMissing && <option value={form.category}>{form.category} (não cadastrada)</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          <Input
            label="Quantidade disponível"
            type="number"
            value={form.quantity}
            onChange={(e) => set("quantity", Number(e.target.value))}
          />
          <Input
            label="Estoque mínimo"
            type="number"
            value={form.minStock}
            onChange={(e) => set("minStock", Number(e.target.value))}
          />
          <Input
            label="Estoque ideal"
            type="number"
            value={form.idealStock}
            onChange={(e) => set("idealStock", Number(e.target.value))}
          />
          <Input
            label="Último custo (R$)"
            type="number"
            step="0.01"
            value={form.lastCost}
            onChange={(e) => set("lastCost", e.target.value)}
          />
          <Input
            label="Data da última compra"
            type="date"
            value={form.lastPurchaseDate}
            onChange={(e) => set("lastPurchaseDate", e.target.value)}
          />
          <Input
            label="Localização física"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={status !== "idle"}>
            Cancelar
          </Button>
          <SaveButton type="submit" status={status} idleLabel="Salvar item" savingLabel="Salvando..." />
        </div>
      </form>
    </Modal>
  );
}
