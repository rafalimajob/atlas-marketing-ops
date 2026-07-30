import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/permissions";
import { UserManagementView } from "@/components/users/user-management-view";
import type { UserDTO } from "@/types/user";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, status: true, mfaEnabled: true, createdAt: true },
  });

  const dto: UserDTO[] = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return <UserManagementView initialUsers={dto} currentUserId={session.user.id} currentUserRole={session.user.role} />;
}
