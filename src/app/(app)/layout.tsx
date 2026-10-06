import { AiProvider } from "@/components/AiContext";
import { Sidebar } from "@/components/Sidebar";
import { canUseAi, isAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const admin = isAdmin(user);
  const ai = canUseAi(user);
  const [dueCount, certDueCount, pendingCount] = await Promise.all([
    db.reviewCard.count({ where: { userId: user.id, dueAt: { lte: now } } }),
    db.studyCard.count({ where: { userId: user.id, dueAt: { lte: now } } }),
    admin ? db.user.count({ where: { status: "PENDING" } }) : 0,
  ]);
  return (
    <AiProvider enabled={ai}>
      <div className="md:flex min-h-screen">
        <Sidebar
          username={user.username}
          dueCount={dueCount}
          certDueCount={certDueCount}
          showAsk={admin}
          pendingCount={pendingCount}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </AiProvider>
  );
}
