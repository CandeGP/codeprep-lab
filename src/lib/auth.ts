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
    include: { user: { select: { id: true, username: true, lang: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { ...session.user, lang: session.user.lang === "es" ? "es" : "en" };
}

/** Admins definidos en ADMIN_USERNAMES (separados por coma). */
export function isAdmin(user: SessionUser) {
  const admins = (process.env.ADMIN_USERNAMES ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  return admins.includes(user.username);
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
