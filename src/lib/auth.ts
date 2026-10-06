import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const SESSION_COOKIE = "codeprep_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; username: string; lang: "en" | "es" };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  jar.delete(SESSION_COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true, lang: true, status: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Si el admin bloquea la cuenta, la sesión deja de valer en la siguiente petición.
  const { status, ...user } = session.user;
  if (status !== "APPROVED" && !isAdminUsername(user.username)) return null;
  return { ...user, lang: user.lang === "es" ? "es" : "en" };
}

function isAdminUsername(username: string) {
  const admins = (process.env.ADMIN_USERNAMES ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  return admins.includes(username);
}

/** Admins definidos en ADMIN_USERNAMES (separados por coma). */
export function isAdmin(user: Pick<SessionUser, "username">) {
  return isAdminUsername(user.username);
}

/** Las cuentas de ADMIN_USERNAMES no necesitan aprobación; el resto sí. */
export function initialStatus(username: string) {
  return isAdminUsername(username) ? "APPROVED" : "PENDING";
}

/** La IA (tutor y generación de preguntas) sólo la usa el admin, para controlar el gasto de la API. */
export function canUseAi(user: SessionUser) {
  return !!process.env.ANTHROPIC_API_KEY && isAdmin(user);
}

/** Para route handlers de IA: devuelve el usuario admin o una respuesta 401/403. */
export async function apiAiUser(): Promise<SessionUser | Response> {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!isAdmin(user)) return Response.json({ error: "La IA sólo está disponible para el administrador" }, { status: 403 });
  return user;
}

/** Para route handlers de administración. */
export async function apiAdmin(): Promise<SessionUser | Response> {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!isAdmin(user)) return Response.json({ error: "Sólo para administradores" }, { status: 403 });
  return user;
}

/** Para páginas: el middleware ya redirige si no hay cookie, pero la sesión puede haber expirado. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user!;
}

/** Para route handlers: devuelve el usuario o una respuesta 401. */
export async function apiUser(): Promise<SessionUser | Response> {
  const user = await getUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  return user;
}
