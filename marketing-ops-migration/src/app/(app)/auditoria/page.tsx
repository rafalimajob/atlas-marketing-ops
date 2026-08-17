import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/permissions";
import { HistoryLogView } from "@/components/history/history-log-view";

export default async function AuditoriaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <HistoryLogView users={users} />;
}
