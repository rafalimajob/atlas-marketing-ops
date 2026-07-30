import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { applyMovement } from "@/lib/movements";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";
import { ENTRADA_TYPES, SAIDA_TYPES, MOVEMENT_TYPE_LABEL } from "@/lib/movement-types";
import type { MovementTypeValue } from "@/lib/movement-types";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = request.nextUrl.searchParams.get("project")?.trim();
  const movements = await prisma.movement.findMany({
    where: project ? { project: { contains: project, mode: "insensitive" } } : undefined,
    include: { stockItem: { select: { name: true, code: true } }, performedBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(movements);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const direction = body?.direction === "ENTRADA" || body?.direction === "SAIDA" ? body.direction : null;
  const type = typeof body?.type === "string" ? body.type : "";
  const quantity = Number(body?.quantity);
  const stockItemId = typeof body?.stockItemId === "string" ? body.stockItemId : "";

  if (!direction) return NextResponse.json({ error: "Direção inválida." }, { status: 400 });
  const allowedTypes = direction === "ENTRADA" ? ENTRADA_TYPES : SAIDA_TYPES;
  if (!allowedTypes.includes(type as never)) {
    return NextResponse.json({ error: "Tipo de movimentação inválido para essa direção." }, { status: 400 });
  }
  if (!stockItemId) return NextResponse.json({ error: "Selecione um item de estoque." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade precisa ser maior que zero." }, { status: 400 });
  }

  try {
    const { movement } = await applyMovement({
      direction,
      type,
      quantity,
      stockItemId,
      project: typeof body?.project === "string" ? body.project.trim() : null,
      notes: typeof body?.notes === "string" ? body.notes.trim() : null,
      orderId: typeof body?.orderId === "string" ? body.orderId : null,
      performedById: session.user.id,
    });

    const full = await prisma.movement.findUnique({
      where: { id: movement.id },
      include: { stockItem: { select: { name: true, code: true } }, performedBy: { select: { name: true } } },
    });

    await logHistory({
      action: "CREATE",
      entity: "MOVEMENT",
      entityId: movement.id,
      summary: `${direction === "ENTRADA" ? "Entrada" : "Saída"} de ${quantity}x ${full?.stockItem.name} (${MOVEMENT_TYPE_LABEL[type as MovementTypeValue]})`,
      userId: session.user.id,
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
