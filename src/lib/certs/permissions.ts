import "server-only";
import { isAdmin, type SessionUser } from "@/lib/auth";

/**
 * El banco de preguntas es compartido: si hay ADMIN_USERNAMES configurados sólo ellos
 * pueden editar, ocultar o borrar preguntas; si no hay ninguno, cualquier usuario puede.
 */
export function canManageBank(user: SessionUser) {
  const anyAdmin = (process.env.ADMIN_USERNAMES ?? "").split(",").some((u) => u.trim());
  return !anyAdmin || isAdmin(user);
}
