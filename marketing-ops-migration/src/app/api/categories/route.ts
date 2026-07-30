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

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome da categoria é obrigatório." }, { status: 400 });

  try {
    const category = await prisma.category.create({ data: { name } });

    await logHistory({
      action: "CREATE",
      entity: "CATEGORY",
      entityId: category.id,
      summary: `Categoria "${category.name}" cadastrada`,
      userId: session.user.id,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
    }
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
