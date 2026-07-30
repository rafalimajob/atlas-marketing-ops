import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

interface KitItemInput {
  stockItemId: string;
  quantity: number;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const items: KitItemInput[] = Array.isArray(body?.items)
    ? body.items
        .filter((i: unknown): i is KitItemInput => {
          const item = i as Partial<KitItemInput>;
          return typeof item?.stockItemId === "string" && Number(item.quantity) > 0;
        })
        .map((i: KitItemInput) => ({ stockItemId: i.stockItemId, quantity: Number(i.quantity) }))
    : [];

  if (!name) return NextResponse.json({ error: "Nome do kit é obrigatório." }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: "Adicione ao menos um item ao kit." }, { status: 400 });

  const uniqueStockItemIds = new Set(items.map((i) => i.stockItemId));
  if (uniqueStockItemIds.size !== items.length) {
    return NextResponse.json({ error: "Cada item só pode aparecer uma vez no kit." }, { status: 400 });
  }

  try {
    // A composição do kit (itens/quantidades) é substituída por completo — as
    // Movements de saídas já registradas guardam seu próprio snapshot de
    // stockItemId/quantidade e não são afetadas por essa edição.
    const kit = await prisma.kit.update({
      where: { id },
      data: {
        name,
        items: {
          deleteMany: {},
          create: items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity })),
        },
      },
      include: { items: { include: { stockItem: { select: { name: true, code: true } } } } },
    });

    await logHistory({
      action: "UPDATE",
      entity: "KIT",
      entityId: kit.id,
      summary: `Kit "${kit.name}" editado`,
      userId: session.user.id,
    });

    return NextResponse.json(kit);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });

  try {
    await prisma.kit.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Este kit não pode ser excluído: existem saídas registradas para ele." },
      { status: 409 }
    );
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "KIT",
      entityId: id,
      summary: `Kit "${existing.name}" excluído`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
