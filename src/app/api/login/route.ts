import { authEnabled, checkPassword, newSessionValue, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Acesso por senha não está configurado." }, { status: 503 });
  const { senha } = await req.json().catch(() => ({}));
  if (!(await checkPassword(String(senha ?? "")))) {
    // Pequena espera para dificultar tentativas em série.
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const { value, maxAge } = await newSessionValue();
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}` } },
  );
}
