// Aviso de versão nova: compara a versão instalada com a última versão publicada no GitHub.
// Não atualiza nada sozinho; só avisa e mostra o que mudou.

/** Versão instalada. Mude junto com a "version" do package.json a cada versão publicada no GitHub. */
export const APP_VERSION = "1.4.0";
export const UPDATE_REPO = "Emerson-Cicigliano/pre-analise-gmn";

export type LatestRelease = { version: string; name: string; notes: string; url: string; publishedAt: string };

const CHECK_KEY = "atualizacao:ultima-consulta";
const DISMISS_KEY = "atualizacao:dispensada";
const DAY = 86_400_000;

/** "v1.10.0" > "v1.9" → 1; iguais → 0. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** Consulta a última versão publicada (API pública do GitHub, sem chave). */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error("Não foi possível consultar o GitHub agora. Tente de novo em alguns minutos.");
  const r = (await res.json()) as { tag_name: string; name: string | null; body: string | null; html_url: string; published_at: string };
  const latest = { version: r.tag_name, name: r.name || r.tag_name, notes: r.body ?? "", url: r.html_url, publishedAt: r.published_at };
  try {
    localStorage.setItem(CHECK_KEY, JSON.stringify({ at: Date.now(), latest }));
  } catch {
    /* armazenamento indisponível */
  }
  return latest;
}

/** Versão nova ainda não dispensada, consultando o GitHub no máximo uma vez por dia. */
export async function pendingUpdate(): Promise<LatestRelease | null> {
  let latest: LatestRelease | null = null;
  try {
    const cached = JSON.parse(localStorage.getItem(CHECK_KEY) ?? "null") as { at: number; latest: LatestRelease } | null;
    if (cached && Date.now() - cached.at < DAY) latest = cached.latest;
  } catch {
    /* sem cache */
  }
  latest ??= await fetchLatestRelease();
  if (compareVersions(latest.version, APP_VERSION) <= 0) return null;
  try {
    if (localStorage.getItem(DISMISS_KEY) === latest.version) return null;
  } catch {
    /* sem armazenamento: mostra o aviso */
  }
  return latest;
}

export function dismissUpdate(version: string) {
  try {
    localStorage.setItem(DISMISS_KEY, version);
  } catch {
    /* armazenamento indisponível */
  }
}
