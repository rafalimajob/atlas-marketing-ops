import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory, diffFields } from "@/lib/history";
import { creditStockForDelivery } from "@/lib/orders";
import { toErrorResponse } from "@/lib/api-errors";
import { ORDER_STATUS_VALUES } from "@/lib/order-status";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { attachments: true, stockItem: { select: { name: true, code: true } } },
  });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.stockItemId === "string") data.stockItemId = body.stockItemId;
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
    }
    data.quantity = quantity;
  }
  if (typeof body.ocNumber === "string") data.ocNumber = body.ocNumber.trim();
  if (typeof body.project === "string") data.project = body.project.trim();
  if (body.status !== undefined) {
    if (!ORDER_STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.requestDate !== undefined) data.requestDate = new Date(body.requestDate);
  if (body.expectedDate !== undefined) data.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;
  if (body.deliveredDate !== undefined) data.deliveredDate = body.deliveredDate ? new Date(body.deliveredDate) : null;
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  // Transição para ENTREGUE credita o estoque automaticamente — só uma vez
  // (idempotente: só dispara quando o status ainda não era ENTREGUE).
  const willDeliver = data.status === "ENTREGUE" && existing.status !== "ENTREGUE";
  if (willDeliver && data.deliveredDate === undefined) data.deliveredDate = new Date();

  const changed = diffFields(existing as unknown as Record<string, unknown>, data);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data,
        include: { attachments: true, stockItem: { select: { name: true, code: true } } },
      });

      if (willDeliver) {
        await creditStockForDelivery(tx, order, session.user.id);
      }

      return order;
    });

    if (Object.keys(changed).length > 0) {
      await logHistory({
        action: "UPDATE",
        entity: "ORDER",
        entityId: updated.id,
        summary: willDeliver
          ? `Pedido (OC ${updated.ocNumber}) confirmado como entregue — ${updated.quantity}x ${updated.stockItem.name} somado ao estoque`
          : `Pedido (OC ${updated.ocNumber}) atualizado`,
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
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  await prisma.order.delete({ where: { id } });

  try {
    await logHistory({
      action: "DELETE",
      entity: "ORDER",
      entityId: id,
      summary: `Pedido (OC ${existing.ocNumber}) excluído`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
