async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
  return data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url));
}

export async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  return handle<T>(
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  );
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
