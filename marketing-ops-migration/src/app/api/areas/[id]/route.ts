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
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome da área é obrigatório." }, { status: 400 });

  try {
    const area = await prisma.area.update({ where: { id }, data: { name } });

    if (area.name !== existing.name) {
      await logHistory({
        action: "UPDATE",
        entity: "AREA",
        entityId: area.id,
        summary: `Área renomeada de "${existing.name}" para "${area.name}"`,
        userId: session.user.id,
      });
    }

    return NextResponse.json(area);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma área com esse nome." }, { status: 409 });
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
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  try {
    await prisma.area.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Esta área não pode ser excluída: existem retiradas registradas para ela." },
      { status: 409 }
    );
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "AREA",
      entityId: id,
      summary: `Área "${existing.name}" excluída`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
