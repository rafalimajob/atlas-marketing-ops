import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { creditStockForDelivery } from "@/lib/orders";
import { toErrorResponse } from "@/lib/api-errors";
import { ORDER_STATUS_VALUES } from "@/lib/order-status";
import type { OrderStatusValue } from "@/lib/order-status";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status");

  const orders = await prisma.order.findMany({
    where: {
      status: status && ORDER_STATUS_VALUES.includes(status as OrderStatusValue) ? (status as OrderStatusValue) : undefined,
      OR: q
        ? [
            { stockItem: { name: { contains: q, mode: "insensitive" } } },
            { ocNumber: { contains: q, mode: "insensitive" } },
            { project: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { attachments: true, stockItem: { select: { name: true, code: true } } },
    orderBy: { requestDate: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const stockItemId = typeof body?.stockItemId === "string" ? body.stockItemId : "";
  const quantity = Number(body?.quantity);
  const ocNumber = typeof body?.ocNumber === "string" ? body.ocNumber.trim() : "";
  const project = typeof body?.project === "string" ? body.project.trim() : "";
  const status = ORDER_STATUS_VALUES.includes(body?.status) ? body.status : "RASCUNHO";

  if (!stockItemId || !ocNumber || !project) {
    return NextResponse.json({ error: "Item do estoque, número da OC e projeto são obrigatórios." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
  }
  if (!body?.requestDate) {
    return NextResponse.json({ error: "Data da solicitação é obrigatória." }, { status: 400 });
  }

  const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!stockItem) return NextResponse.json({ error: "Item do estoque não encontrado." }, { status: 400 });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          stockItemId,
          quantity,
          ocNumber,
          project,
          status,
          requestDate: new Date(body.requestDate),
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
          deliveredDate: body.deliveredDate ? new Date(body.deliveredDate) : status === "ENTREGUE" ? new Date() : null,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        },
        include: { attachments: true, stockItem: { select: { name: true, code: true } } },
      });

      if (created.status === "ENTREGUE") {
        await creditStockForDelivery(tx, created, session.user.id);
      }

      return created;
    });

    await logHistory({
      action: "CREATE",
      entity: "ORDER",
      entityId: order.id,
      summary: `Pedido de ${order.quantity}x ${order.stockItem.name} (OC ${order.ocNumber}) criado`,
      userId: session.user.id,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
