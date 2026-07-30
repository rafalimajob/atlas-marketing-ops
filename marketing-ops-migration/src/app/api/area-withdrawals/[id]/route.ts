import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { updateAreaWithdrawal, deleteMovement } from "@/lib/movements";
import { logHistory, diffFields } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_A_WITHDRAWAL = "Esta movimentação não é uma retirada de Consumo por área.";
const KIT_LOCKED_MESSAGE =
  "Esta retirada foi gerada automaticamente por uma saída de kit e não pode ser editada ou excluída aqui.";

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.movement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Retirada não encontrada." }, { status: 404 });
  if (!existing.areaId) return NextResponse.json({ error: NOT_A_WITHDRAWAL }, { status: 409 });
  if (existing.kitOutputId) return NextResponse.json({ error: KIT_LOCKED_MESSAGE }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const areaId = typeof body.areaId === "string" && body.areaId ? body.areaId : existing.areaId;
  const stockItemId = typeof body.stockItemId === "string" && body.stockItemId ? body.stockItemId : existing.stockItemId;
  const quantity = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
  const project = typeof body.project === "string" ? body.project.trim() || null : existing.project;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : existing.notes;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
  }

  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  try {
    const updated = await updateAreaWithdrawal(id, {
      areaId,
      stockItemId,
      quantity,
      project,
      notes,
      performedById: session.user.id,
    });

    const full = await prisma.movement.findUnique({
      where: { id: updated.id },
      include: {
        stockItem: { select: { name: true, code: true } },
        performedBy: { select: { name: true } },
        area: { select: { id: true, name: true } },
      },
    });

    const changed = diffFields(existing as unknown as Record<string, unknown>, { areaId, stockItemId, quantity, project, notes });
    if (Object.keys(changed).length > 0) {
      await logHistory({
        action: "UPDATE",
        entity: "MOVEMENT",
        entityId: id,
        summary: `Retirada de ${full?.stockItem.name} pela área "${area.name}" editada`,
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
    include: { stockItem: { select: { name: true } }, area: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Retirada não encontrada." }, { status: 404 });
  if (!existing.areaId) return NextResponse.json({ error: NOT_A_WITHDRAWAL }, { status: 409 });
  if (existing.kitOutputId) return NextResponse.json({ error: KIT_LOCKED_MESSAGE }, { status: 409 });

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
      summary: `Retirada de ${existing.quantity}x ${existing.stockItem.name} pela área "${existing.area?.name}" excluída`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
