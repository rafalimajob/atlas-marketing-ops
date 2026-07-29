"use client";

import { useMemo, useState, FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SaveButton, type SaveStatus } from "@/components/ui/save-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { AreaDTO } from "@/types/area";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AreaWithdrawalModal({
  withdrawal,
  areas,
  stock,
  onClose,
  onSaved,
}: {
  withdrawal?: MovementDTO;
  areas: AreaDTO[];
  stock: StockOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [areaId, setAreaId] = useState(withdrawal?.area?.id ?? areas[0]?.id ?? "");
  const [stockItemId, setStockItemId] = useState(withdrawal?.stockItemId ?? stock[0]?.id ?? "");
  const [quantity, setQuantity] = useState(withdrawal?.quantity ?? 1);
  const [project, setProject] = useState(withdrawal?.project ?? "");
  const [notes, setNotes] = useState(withdrawal?.notes ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(() => stock.find((s) => s.id === stockItemId), [stock, stockItemId]);
  const unitCost = selectedItem?.lastCost ? Number(selectedItem.lastCost) : null;
  const totalCost = unitCost != null ? unitCost * quantity : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(withdrawal ? `/api/area-withdrawals/${withdrawal.id}` : "/api/area-withdrawals", {
        method: withdrawal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, stockItemId, quantity, project, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Não foi possível ${withdrawal ? "salvar" : "registrar"} a retirada.`);
      onSaved();
      setStatus("success");
      setTimeout(onClose, 550);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setStatus("idle");
    }
  }

  if (areas.length === 0) {
    return (
      <Modal title="Nova retirada" onClose={onClose}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma área cadastrada ainda. Cadastre uma área em &ldquo;Gerenciar áreas&rdquo; antes de registrar uma retirada.
        </p>
        <div className="flex justify-end pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={withdrawal ? "Editar retirada" : "Nova retirada por área"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid gap-3">
          <Select label="Área" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
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
          <Input label="Projeto/Campanha (opcional)" value={project} onChange={(e) => setProject(e.target.value)} />
          <TextArea label="Observação" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {unitCost != null ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Custo estimado: {fmtBRL(unitCost)}/un. · Total: <span className="font-medium">{fmtBRL(totalCost ?? 0)}</span>
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Este item não tem custo cadastrado — a retirada será registrada sem valor financeiro.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={status !== "idle"}>
            Cancelar
          </Button>
          <SaveButton
            type="submit"
            status={status}
            idleLabel={withdrawal ? "Salvar" : "Registrar retirada"}
            savingLabel={withdrawal ? "Salvando..." : "Registrando..."}
            disabled={!areaId || !stockItemId}
          />
        </div>
      </form>
    </Modal>
  );
}
