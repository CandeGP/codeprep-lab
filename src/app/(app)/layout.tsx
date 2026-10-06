import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const [dueCount, certDueCount] = await Promise.all([
    db.reviewCard.count({ where: { userId: user.id, dueAt: { lte: now } } }),
    db.studyCard.count({ where: { userId: user.id, dueAt: { lte: now } } }),
  ]);
  return (
    <div className="md:flex min-h-screen">
      <Sidebar username={user.username} dueCount={dueCount} certDueCount={certDueCount} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
