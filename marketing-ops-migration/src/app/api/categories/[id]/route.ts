import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome da categoria é obrigatório." }, { status: 400 });

  try {
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: { name } });
      // Mantém os itens de estoque já cadastrados com o nome atualizado, já que
      // StockItem.category é um campo texto livre (não uma FK para Category).
      if (updated.name !== existing.name) {
        await tx.stockItem.updateMany({ where: { category: existing.name }, data: { category: updated.name } });
      }
      return updated;
    });

    if (category.name !== existing.name) {
      await logHistory({
        action: "UPDATE",
        entity: "CATEGORY",
        entityId: category.id,
        summary: `Categoria renomeada de "${existing.name}" para "${category.name}"`,
        userId: session.user.id,
      });
    }

    return NextResponse.json(category);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
    }
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });

  const inUse = await prisma.stockItem.count({ where: { category: existing.name } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: "Esta categoria não pode ser excluída: existem itens de estoque cadastrados nela." },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id } });

  try {
    await logHistory({
      action: "DELETE",
      entity: "CATEGORY",
      entityId: id,
      summary: `Categoria "${existing.name}" excluída`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
