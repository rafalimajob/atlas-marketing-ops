import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { updateMovement, deleteMovement, isMovementLocked } from "@/lib/movements";
import { logHistory, diffFields } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";
import { ENTRADA_TYPES, SAIDA_TYPES, MOVEMENT_TYPE_LABEL } from "@/lib/movement-types";
import type { MovementTypeValue } from "@/lib/movement-types";

type RouteContext = { params: Promise<{ id: string }> };

const LOCKED_MESSAGE =
  "Esta movimentação foi gerada automaticamente (pedido, kit ou consumo por área) e não pode ser editada ou excluída aqui.";

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.movement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Movimentação não encontrada." }, { status: 404 });
  if (isMovementLocked(existing)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const direction = body.direction === "ENTRADA" || body.direction === "SAIDA" ? body.direction : existing.direction;
  const type = typeof body.type === "string" ? body.type : existing.type;
  const quantity = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
  const stockItemId = typeof body.stockItemId === "string" && body.stockItemId ? body.stockItemId : existing.stockItemId;

  const allowedTypes = direction === "ENTRADA" ? ENTRADA_TYPES : SAIDA_TYPES;
  if (!allowedTypes.includes(type as never)) {
    return NextResponse.json({ error: "Tipo de movimentação inválido para essa direção." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
  }

  const project = typeof body.project === "string" ? body.project.trim() || null : existing.project;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : existing.notes;

  try {
    const updated = await updateMovement(id, {
      direction,
      type,
      quantity,
      stockItemId,
      project,
      notes,
      performedById: session.user.id,
    });

    const full = await prisma.movement.findUnique({
      where: { id: updated.id },
      include: { stockItem: { select: { name: true, code: true } }, performedBy: { select: { name: true } } },
    });

    const changed = diffFields(existing as unknown as Record<string, unknown>, {
      direction,
      type,
      quantity,
      stockItemId,
      project,
      notes,
    });
    if (Object.keys(changed).length > 0) {
      await logHistory({
        action: "UPDATE",
        entity: "MOVEMENT",
        entityId: id,
        summary: `Movimentação de ${full?.stockItem.name} (${MOVEMENT_TYPE_LABEL[type as MovementTypeValue]}) editada`,
        userId: session.user.id,
        diff: changed,
      });
    }

    return NextResponse.json(full);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.movement.findUnique({
    where: { id },
    include: { stockItem: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Movimentação não encontrada." }, { status: 404 });
  if (isMovementLocked(existing)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });

  try {
    await deleteMovement(id, session.user.id);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "MOVEMENT",
      entityId: id,
      summary: `Movimentação de ${existing.direction === "ENTRADA" ? "entrada" : "saída"} de ${existing.quantity}x ${existing.stockItem.name} excluída`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
