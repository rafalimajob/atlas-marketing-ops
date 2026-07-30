import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { applyMovement } from "@/lib/movements";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const withdrawals = await prisma.movement.findMany({
    where: { areaId: { not: null } },
    include: {
      stockItem: { select: { name: true, code: true } },
      performedBy: { select: { name: true } },
      area: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(withdrawals);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const areaId = typeof body?.areaId === "string" ? body.areaId : "";
  const stockItemId = typeof body?.stockItemId === "string" ? body.stockItemId : "";
  const quantity = Number(body?.quantity);

  if (!areaId) return NextResponse.json({ error: "Selecione uma área." }, { status: 400 });
  if (!stockItemId) return NextResponse.json({ error: "Selecione um item de estoque." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
  }

  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  try {
    // Retirada por área é sempre uma saída para consumo interno — direção e
    // tipo não vêm do cliente, evitando que a rota seja usada para outros fins.
    const { movement } = await applyMovement({
      direction: "SAIDA",
      type: "CONSUMO_INTERNO",
      quantity,
      stockItemId,
      areaId,
      project: typeof body?.project === "string" ? body.project.trim() : null,
      notes: typeof body?.notes === "string" ? body.notes.trim() : null,
      performedById: session.user.id,
    });

    const full = await prisma.movement.findUnique({
      where: { id: movement.id },
      include: {
        stockItem: { select: { name: true, code: true } },
        performedBy: { select: { name: true } },
        area: { select: { id: true, name: true } },
      },
    });

    await logHistory({
      action: "CREATE",
      entity: "MOVEMENT",
      entityId: movement.id,
      summary: `Retirada de ${quantity}x ${full?.stockItem.name} pela área "${area.name}"`,
      userId: session.user.id,
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
