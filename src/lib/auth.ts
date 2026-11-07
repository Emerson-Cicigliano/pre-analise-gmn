import "server-only";
import { cookies } from "next/headers";

// Acesso por senha única (APP_SENHA), no mesmo esquema do Radar de Concorrentes:
// cookie "<expira>.<HMAC(expira)>" assinado com a própria senha. Trocar a senha derruba todas as sessões.
export const SESSION_COOKIE = "gmn_acesso";
const SESSION_DAYS = 30;

const senha = () => process.env.APP_SENHA ?? "";
/** Sem APP_SENHA (uso local) o app fica aberto; online a senha é sempre configurada. */
export const authEnabled = () => senha().length > 0;

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(attempt: string): Promise<boolean> {
  if (!authEnabled()) return false;
  // Compara os HMACs para o tempo não depender do conteúdo da senha.
  return sameString(await hmac("cmp", attempt), await hmac("cmp", senha()));
}

export async function newSessionValue(): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const exp = String(Date.now() + maxAge * 1000);
  return { value: `${exp}.${await hmac(senha(), `sessao:${exp}`)}`, maxAge };
}

async function validSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sameString(sig, await hmac(senha(), `sessao:${exp}`));
}

/** Para páginas (componentes de servidor). */
export async function isLoggedIn(): Promise<boolean> {
  if (!authEnabled()) return true;
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Para rotas de API: devolve a resposta 401 quando não há sessão válida. */
export async function requireAuth(): Promise<Response | null> {
  if (await isLoggedIn()) return null;
  return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
