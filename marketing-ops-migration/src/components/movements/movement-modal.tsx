"use client";

import { useState, FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SaveButton, type SaveStatus } from "@/components/ui/save-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ENTRADA_TYPES, SAIDA_TYPES, MOVEMENT_TYPE_LABEL } from "@/lib/movement-types";
import type { MovementTypeValue } from "@/lib/movement-types";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";

export function MovementModal({
  movement,
  stock,
  onClose,
  onSaved,
}: {
  movement?: MovementDTO;
  stock: StockOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<"ENTRADA" | "SAIDA">(movement?.direction ?? "ENTRADA");
  const [type, setType] = useState<MovementTypeValue>(movement?.type ?? ENTRADA_TYPES[0]);
  const [stockItemId, setStockItemId] = useState(movement?.stockItemId ?? stock[0]?.id ?? "");
  const [quantity, setQuantity] = useState(movement?.quantity ?? 1);
  const [project, setProject] = useState(movement?.project ?? "");
  const [notes, setNotes] = useState(movement?.notes ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const types = direction === "ENTRADA" ? ENTRADA_TYPES : SAIDA_TYPES;

  function changeDirection(next: "ENTRADA" | "SAIDA") {
    setDirection(next);
    setType(next === "ENTRADA" ? ENTRADA_TYPES[0] : SAIDA_TYPES[0]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(movement ? `/api/movements/${movement.id}` : "/api/movements", {
        method: movement ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, type, stockItemId, quantity, project, notes }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? `Não foi possível ${movement ? "salvar" : "registrar"} a movimentação.`);
      onSaved();
      setStatus("success");
      setTimeout(onClose, 550);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setStatus("idle");
    }
  }

  return (
    <Modal title={movement ? "Editar movimentação" : "Nova movimentação"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeDirection("ENTRADA")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              direction === "ENTRADA"
                ? "bg-brand-ok text-white"
                : "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => changeDirection("SAIDA")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              direction === "SAIDA"
                ? "bg-brand-crit text-white"
                : "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            Saída
          </button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid gap-3">
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as MovementTypeValue)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select label="Item" value={stockItemId} onChange={(e) => setStockItemId(e.target.value)}>
            {stock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.quantity} disp.)
              </option>
            ))}
          </Select>
          <Input
            label="Quantidade"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <Input label="Projeto/Campanha" value={project} onChange={(e) => setProject(e.target.value)} />
          <TextArea label="Observação" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={status !== "idle"}>
            Cancelar
          </Button>
          <SaveButton
            type="submit"
            status={status}
            idleLabel={movement ? "Salvar" : "Registrar"}
            savingLabel={movement ? "Salvando..." : "Registrando..."}
            disabled={!stockItemId}
          />
        </div>
      </form>
    </Modal>
  );
}
