import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory, diffFields } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";
import { isMovementLocked } from "@/lib/movements";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.stockItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.category === "string") data.category = body.category.trim();
  if (body.quantity !== undefined) data.quantity = Number(body.quantity) || 0;
  if (body.minStock !== undefined) data.minStock = Number(body.minStock) || 0;
  if (body.idealStock !== undefined) data.idealStock = Number(body.idealStock) || 0;
  if (body.lastCost !== undefined) data.lastCost = body.lastCost === "" || body.lastCost === null ? null : Number(body.lastCost);
  if (body.lastPurchaseDate !== undefined) {
    data.lastPurchaseDate = body.lastPurchaseDate ? new Date(body.lastPurchaseDate) : null;
  }
  if (body.location !== undefined) data.location = typeof body.location === "string" ? body.location.trim() || null : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const changed = diffFields(existing as unknown as Record<string, unknown>, data);
  data.updatedById = session.user.id;

  try {
    const updated = await prisma.stockItem.update({ where: { id }, data });

    if (Object.keys(changed).length > 0) {
      await logHistory({
        action: "UPDATE",
        entity: "STOCK_ITEM",
        entityId: updated.id,
        summary: `Item de estoque ${updated.code} (${updated.name}) atualizado`,
        userId: session.user.id,
        diff: changed,
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.stockItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  const [orderCount, movements, kitItemCount] = await Promise.all([
    prisma.order.count({ where: { stockItemId: id } }),
    prisma.movement.findMany({
      where: { stockItemId: id },
      select: { orderId: true, kitOutputId: true, areaId: true },
    }),
    prisma.kitItem.count({ where: { stockItemId: id } }),
  ]);

  if (orderCount > 0 || movements.length > 0 || kitItemCount > 0) {
    const freeMovements = movements.filter((m) => !isMovementLocked(m)).length;
    const orderMovements = movements.filter((m) => m.orderId).length;
    const kitMovements = movements.filter((m) => m.kitOutputId).length;
    const areaMovements = movements.filter((m) => m.areaId).length;

    const parts: string[] = [];
    if (orderCount > 0) parts.push(`${orderCount} pedido(s) de compra`);
    if (freeMovements > 0) {
      parts.push(`${freeMovements} movimentação(ões) manual(is) — exclua-as em Movimentações antes de excluir o item`);
    }
    if (areaMovements > 0) {
      parts.push(`${areaMovements} retirada(s) de Consumo por área — exclua-as em Consumo por área antes de excluir o item`);
    }
    if (orderMovements > 0) parts.push(`${orderMovements} movimentação(ões) geradas por entrega de pedido`);
    if (kitMovements > 0) parts.push(`${kitMovements} movimentação(ões) geradas por saída de kit`);
    if (kitItemCount > 0) parts.push(`${kitItemCount} kit(s) que usam este item na receita`);

    return NextResponse.json(
      { error: `Este item não pode ser excluído: ${parts.join("; ")}.` },
      { status: 409 }
    );
  }

  try {
    await prisma.stockItem.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Este item não pode ser excluído: existem pedidos, movimentações ou kits vinculados a ele." },
      { status: 409 }
    );
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "STOCK_ITEM",
      entityId: id,
      summary: `Item de estoque ${existing.code} (${existing.name}) excluído`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
