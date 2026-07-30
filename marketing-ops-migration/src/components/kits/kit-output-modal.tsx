"use client";

import { useState, FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SaveButton, type SaveStatus } from "@/components/ui/save-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { KitDTO } from "@/types/kit";
import type { AreaDTO } from "@/types/area";

export function KitOutputModal({
  kit,
  areas,
  onClose,
  onSaved,
}: {
  kit: KitDTO;
  areas: AreaDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  if (areas.length === 0) {
    return (
      <Modal title={`Saída de kit: ${kit.name}`} onClose={onClose}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma área cadastrada ainda. Cadastre uma área em &ldquo;Gerenciar áreas&rdquo; (tela Consumo por área)
          antes de registrar uma saída de kit.
        </p>
        <div className="flex justify-end pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Modal>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(`/api/kits/${kit.id}/output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, quantity, project, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível registrar a saída do kit.");
      onSaved();
      setStatus("success");
      setTimeout(onClose, 550);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setStatus("idle");
    }
  }

  return (
    <Modal title={`Saída de kit: ${kit.name}`} onClose={onClose}>
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
          <Input
            label="Quantidade de kits"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <Input label="Projeto/Campanha" value={project} onChange={(e) => setProject(e.target.value)} />
          <TextArea label="Observação" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Isso reduzirá automaticamente o estoque de todos os itens que compõem o kit e lançará a saída em
          Consumo por área.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={status !== "idle"}>
            Cancelar
          </Button>
          <SaveButton
            type="submit"
            status={status}
            idleLabel="Confirmar saída"
            savingLabel="Confirmando..."
            disabled={!areaId}
          />
        </div>
      </form>
    </Modal>
  );
}
