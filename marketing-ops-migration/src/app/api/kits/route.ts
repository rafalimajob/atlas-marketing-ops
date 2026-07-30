import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const kits = await prisma.kit.findMany({
    include: {
      items: { include: { stockItem: { select: { name: true, code: true, lastCost: true } } } },
      // Só a contagem aqui — o histórico de saídas é paginado e carregado sob
      // demanda em GET /api/kits/[id]/outputs, senão essa lista cresceria sem
      // limite conforme o volume de saídas registradas.
      _count: { select: { outputs: true } },
    },
    orderBy: { name: "asc" },
  });
  // Mapeado explicitamente para `outputsCount` (o formato que o KitDTO do
  // cliente espera) em vez de devolver `_count.outputs` cru — o mesmo formato
  // usado pelo carregamento inicial da página em `kits/page.tsx`.
  return NextResponse.json(kits.map((k) => ({ id: k.id, name: k.name, items: k.items, outputsCount: k._count.outputs })));
}

interface KitItemInput {
  stockItemId: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

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
    const kit = await prisma.kit.create({
      data: {
        name,
        items: { create: items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity })) },
      },
      include: {
        items: { include: { stockItem: { select: { name: true, code: true, lastCost: true } } } },
        _count: { select: { outputs: true } },
      },
    });

    await logHistory({
      action: "CREATE",
      entity: "KIT",
      entityId: kit.id,
      summary: `Kit "${kit.name}" cadastrado com ${items.length} item(ns)`,
      userId: session.user.id,
    });

    return NextResponse.json(
      { id: kit.id, name: kit.name, items: kit.items, outputsCount: kit._count.outputs },
      { status: 201 }
    );
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
