import { isAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { describeUserAgent } from "@/lib/request-meta";
import { LangSetting } from "./LangSetting";

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "—";

const KIND = { REGISTER: "Registro", LOGIN: "Inicio de sesión" } as Record<string, string>;

type Event = { id: string; kind: string; ip: string | null; userAgent: string | null; language: string | null; createdAt: Date };

function EventRow({ e }: { e: Event }) {
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 pr-3 whitespace-nowrap">{fmt(e.createdAt)}</td>
      <td className="py-1.5 pr-3">{KIND[e.kind] ?? e.kind}</td>
      <td className="py-1.5 pr-3 font-mono">{e.ip ?? "—"}</td>
      <td className="py-1.5 pr-3" title={e.userAgent ?? ""}>{describeUserAgent(e.userAgent)}</td>
      <td className="py-1.5">{e.language ?? "—"}</td>
    </tr>
  );
}

function EventTable({ events }: { events: Event[] }) {
  if (!events.length) return <p className="text-sm text-muted">Sin registros de acceso todavía.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-muted">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Fecha</th>
            <th className="py-1.5 pr-3 font-medium">Evento</th>
            <th className="py-1.5 pr-3 font-medium">IP</th>
            <th className="py-1.5 pr-3 font-medium">Navegador</th>
            <th className="py-1.5 font-medium">Idioma</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);

  const [me, myEvents] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true } }),
    db.loginEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const users = admin
    ? await db.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          createdAt: true,
          pdf: { select: { filename: true } },
          sessions: { where: { expiresAt: { gt: new Date() } }, select: { id: true } },
          loginEvents: { orderBy: { createdAt: "desc" }, take: 20 },
          _count: { select: { loginEvents: true, notes: true, progress: true, submissions: true, chatMessages: true } },
        },
      })
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Configuración</h1>

      <section className="mt-8">
        <h2 className="font-semibold text-lg">Tu cuenta</h2>
        <div className="card p-4 mt-2 space-y-3">
          <LangSetting initial={user.lang} />
          <div className="text-sm">
            <span className="text-muted">Usuario: </span>
            <span className="font-medium">{user.username}</span>
            {admin && <span className="ml-2 rounded-full bg-accent/10 text-accent text-[10px] font-bold px-1.5 py-0.5">ADMIN</span>}
            <span className="text-muted"> · registrado el {fmt(me.createdAt)}</span>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Accesos recientes</h3>
            <EventTable events={myEvents} />
          </div>
        </div>
      </section>

      {admin && (
        <section className="mt-10">
          <h2 className="font-semibold text-lg">Usuarios registrados ({users.length})</h2>
          <p className="text-sm text-muted mt-1">
            Solo lo ven los usuarios en <code>ADMIN_USERNAMES</code>. La IP y el navegador se guardan a partir de ahora en cada
            registro e inicio de sesión; los usuarios anteriores no tienen ese historial.
          </p>
          <div className="mt-3 space-y-3">
            {users.map((u) => {
              const last = u.loginEvents[0];
              const reg = u.loginEvents.find((e) => e.kind === "REGISTER");
              return (
                <details key={u.id} className="card p-4 group">
                  <summary className="cursor-pointer list-none flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-semibold">{u.username}</span>
                    <span className="text-xs text-muted">Registro: {fmt(u.createdAt)}</span>
                    <span className="text-xs text-muted">Último acceso: {fmt(last?.createdAt)}</span>
                    <span className="text-xs text-muted font-mono">{last?.ip ?? ""}</span>
                    <span className="text-xs text-muted">{last ? describeUserAgent(last.userAgent) : ""}</span>
                    <span className="ml-auto text-xs text-accent group-open:hidden">Ver detalles ▾</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <Stat label="Sesiones activas" value={u.sessions.length} />
                      <Stat label="Inicios de sesión" value={u._count.loginEvents} />
                      <Stat label="Lecciones completadas" value={u._count.progress} />
                      <Stat label="Envíos de código" value={u._count.submissions} />
                      <Stat label="Notas" value={u._count.notes} />
                      <Stat label="Mensajes a la IA" value={u._count.chatMessages} />
                      <Stat label="PDF subido" value={u.pdf?.filename ?? "No"} />
                      <Stat label="IP de registro" value={reg?.ip ?? "—"} mono />
                    </dl>
                    {last?.userAgent && (
                      <p className="text-xs text-muted break-all">
                        <span className="font-medium">User-Agent completo:</span> {last.userAgent}
                      </p>
                    )}
                    <EventTable events={u.loginEvents} />
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2 min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
