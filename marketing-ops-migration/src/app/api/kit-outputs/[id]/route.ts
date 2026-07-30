import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { deleteKitOutput } from "@/lib/movements";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.kitOutput.findUnique({
    where: { id },
    include: { kit: { select: { id: true, name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Saída de kit não encontrada." }, { status: 404 });

  try {
    await deleteKitOutput(id, session.user.id);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "KIT",
      entityId: existing.kit.id,
      summary: `Saída de ${existing.quantity}x kit "${existing.kit.name}" desfeita — estoque restaurado`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
