"use client";

import { useState, FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SaveButton, type SaveStatus } from "@/components/ui/save-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { StockOptionDTO } from "@/types/movement";
import type { KitDTO } from "@/types/kit";

interface KitLine {
  stockItemId: string;
  quantity: number;
}

export function KitModal({
  kit,
  stock,
  onClose,
  onSaved,
}: {
  kit?: KitDTO;
  stock: StockOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kit?.name ?? "");
  const [items, setItems] = useState<KitLine[]>(
    kit?.items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity })) ?? [
      { stockItemId: stock[0]?.id ?? "", quantity: 1 },
    ]
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  function addLine() {
    setItems((prev) => [...prev, { stockItemId: stock[0]?.id ?? "", quantity: 1 }]);
  }
  function setLine(i: number, patch: Partial<KitLine>) {
    setItems((prev) => prev.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }
  function removeLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(kit ? `/api/kits/${kit.id}` : "/api/kits", {
        method: kit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar o kit.");
      onSaved();
      setStatus("success");
      setTimeout(onClose, 550);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setStatus("idle");
    }
  }

  return (
    <Modal title={kit ? "Editar kit" : "Novo kit"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <Input label="Nome do kit" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />

        <div className="space-y-2">
          {items.map((line, i) => (
            <div key={i} className="flex items-end gap-2">
              <Select
                label="Item"
                value={line.stockItemId}
                onChange={(e) => setLine(i, { stockItemId: e.target.value })}
                className="flex-1"
              >
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Qtd."
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                className="w-20"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={items.length === 1}
                className="mb-2 text-brand-crit hover:opacity-70 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={addLine}>
          <Plus size={14} /> Adicionar item
        </Button>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={status !== "idle"}>
            Cancelar
          </Button>
          <SaveButton
            type="submit"
            status={status}
            idleLabel={kit ? "Salvar" : "Salvar kit"}
            savingLabel="Salvando..."
          />
        </div>
      </form>
    </Modal>
  );
}
