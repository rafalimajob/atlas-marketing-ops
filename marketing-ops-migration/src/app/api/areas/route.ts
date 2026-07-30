import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const areas = await prisma.area.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(areas);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome da área é obrigatório." }, { status: 400 });

  try {
    const area = await prisma.area.create({ data: { name } });

    await logHistory({
      action: "CREATE",
      entity: "AREA",
      entityId: area.id,
      summary: `Área "${area.name}" cadastrada`,
      userId: session.user.id,
    });

    return NextResponse.json(area, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma área com esse nome." }, { status: 409 });
    }
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
