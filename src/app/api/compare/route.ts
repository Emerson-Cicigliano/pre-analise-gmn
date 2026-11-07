import { requireAuth } from "@/lib/auth";
import { businessInfo, hasDataForSeo, type BusinessInfo } from "@/lib/dataforseo";
import { getLatestGrid } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { getPlaceDetails } from "@/lib/places";
import { regionRanking } from "@/lib/region";
import type { CompareResult, CompareStatus, PlaceDetails } from "@/lib/types";

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "perto", "mim", "the", "a", "o"]);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));

function haversineKm(a: PlaceDetails["location"], b: PlaceDetails["location"]) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compara números: maior é melhor. `tolerance` define quando conta como empate. */
function cmp(a: number, b: number, tolerance = 0): CompareStatus {
  if (Math.abs(a - b) <= tolerance) return "igual";
  return a > b ? "frente" : "atras";
}

function yesNo(a: boolean, b: boolean): CompareStatus {
  return a === b ? "igual" : a ? "frente" : "atras";
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId } = await req.json().catch(() => ({}));
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });

  try {
    const grid = await getLatestGrid(String(placeId));
    if (!grid) return Response.json({ error: "Rode a grade de posição primeiro." }, { status: 400 });

    const ranking = regionRanking(grid, String(placeId), 50);
    const me = ranking.find((r) => r.isTarget);
    // Só concorrentes com ID do Google (a DataForSEO raramente devolve um resultado sem ele).
    const others = ranking.filter((r) => !r.isTarget && /^[A-Za-z0-9_-]{10,}$/.test(r.id));
    const alreadyFirst = me?.position === 1;
    // Compara com o 1º colocado; se a empresa já é a 1ª, com o 2º (quem está logo atrás).
    const rival = others[0];
    if (!rival) return Response.json({ error: "Não há concorrentes na grade para comparar." }, { status: 400 });

    const [mine, theirs] = await Promise.all([getPlaceDetails(String(placeId)), getPlaceDetails(rival.id)]);
    let infoMine: BusinessInfo | null = null;
    let infoTheirs: BusinessInfo | null = null;
    if (hasDataForSeo()) {
      [infoMine, infoTheirs] = await Promise.all([businessInfo(mine.id), businessInfo(theirs.id)]);
    }

    const rows: CompareResult["rows"] = [];
    const kw = words(grid.keyword);
    const matchesKw = (s: string | null | undefined) => !!s && kw.some((w) => norm(s).includes(w));

    const catMine = infoMine?.category ?? mine.category;
    const catTheirs = infoTheirs?.category ?? theirs.category;
    rows.push({
      criterio: "Categoria principal",
      voce: catMine ?? "—",
      concorrente: catTheirs ?? "—",
      status: norm(catMine ?? "") === norm(catTheirs ?? "") ? "igual" : yesNo(matchesKw(catMine), matchesKw(catTheirs)),
    });
    rows.push({
      criterio: "Avaliações",
      voce: String(mine.userRatingCount),
      concorrente: String(theirs.userRatingCount),
      status: cmp(mine.userRatingCount, theirs.userRatingCount),
    });
    rows.push({
      criterio: "Nota média",
      voce: mine.rating?.toFixed(1).replace(".", ",") ?? "—",
      concorrente: theirs.rating?.toFixed(1).replace(".", ",") ?? "—",
      status: cmp(mine.rating ?? 0, theirs.rating ?? 0, 0.05),
    });
    const photosMine = infoMine?.totalPhotos ?? mine.photosCount;
    const photosTheirs = infoTheirs?.totalPhotos ?? theirs.photosCount;
    const capped = (n: number) => (infoMine ? String(n) : n >= 10 ? "10+" : String(n));
    rows.push({
      criterio: "Fotos",
      voce: capped(photosMine),
      concorrente: capped(photosTheirs),
      status: infoMine ? cmp(photosMine, photosTheirs) : cmp(Math.min(photosMine, 10), Math.min(photosTheirs, 10)),
    });
    if (infoMine && infoTheirs) {
      const dMine = infoMine.description?.length ?? 0;
      const dTheirs = infoTheirs.description?.length ?? 0;
      rows.push({
        criterio: "Descrição",
        voce: dMine ? `${dMine} caracteres` : "sem descrição",
        concorrente: dTheirs ? `${dTheirs} caracteres` : "sem descrição",
        // Acima de ~250 caracteres, as duas descrições já cumprem o papel.
        status: dMine >= 250 && dTheirs >= 250 ? "igual" : cmp(dMine, dTheirs),
      });
      rows.push({
        criterio: "Categorias secundárias",
        voce: infoMine.additionalCategories.join(", ") || "nenhuma",
        concorrente: infoTheirs.additionalCategories.join(", ") || "nenhuma",
        status: cmp(infoMine.additionalCategories.length, infoTheirs.additionalCategories.length),
      });
    }
    rows.push({
      criterio: "Website",
      voce: mine.website ? "site próprio" : "não tem",
      concorrente: theirs.website ? "site próprio" : "não tem",
      status: yesNo(!!mine.website, !!theirs.website),
    });
    rows.push({
      criterio: "Horário de funcionamento",
      voce: mine.hours.length ? "definido" : "não definido",
      concorrente: theirs.hours.length ? "definido" : "não definido",
      status: yesNo(mine.hours.length > 0, theirs.hours.length > 0),
    });
    const nameMine = matchesKw(mine.name);
    const nameTheirs = matchesKw(theirs.name);
    rows.push({
      criterio: "Palavra da busca no nome",
      voce: nameMine ? "sim" : "não",
      concorrente: nameTheirs ? "sim" : "não",
      status: yesNo(nameMine, nameTheirs),
    });

    const PLANO: Record<string, string> = {
      "Categoria principal": `Revise a categoria principal: a do concorrente combina melhor com a busca "${grid.keyword}".`,
      Avaliações: `Aumente o volume de avaliações: o concorrente tem ${theirs.userRatingCount} e você ${mine.userRatingCount}. Use o card com QR code e peça avaliação após cada atendimento.`,
      "Nota média": "Melhore a nota média respondendo todas as avaliações e resolvendo as críticas que se repetem.",
      Fotos: "Publique mais fotos reais (fachada, equipe, ambiente, produtos) toda semana.",
      Descrição: "Complete a descrição do perfil (até 750 caracteres) com os serviços e a região atendida.",
      "Categorias secundárias": `Adicione categorias secundárias relevantes${infoTheirs?.additionalCategories.length ? ` (o concorrente usa: ${infoTheirs.additionalCategories.join(", ")})` : ""}.`,
      Website: "Vincule um site ou página de destino ao perfil.",
      "Horário de funcionamento": "Defina o horário de funcionamento para aparecer no filtro “aberto agora”.",
      "Palavra da busca no nome":
        "O concorrente usa palavras da busca no nome, e o Google dá peso a isso. Só mude o seu se for o nome real da empresa: nome com palavras extras pode suspender o perfil.",
    };
    const plano = rows.filter((r) => r.status === "atras").map((r) => PLANO[r.criterio]).filter(Boolean);
    if (!plano.length) {
      plano.push(
        alreadyFirst
          ? "A empresa está à frente ou empatada em todos os critérios do perfil. Mantenha a frequência de avaliações, fotos e postagens para continuar em 1º."
          : "A empresa está à frente ou empatada em todos os critérios do perfil. A diferença vem de sinais que o perfil não mostra, como histórico, cliques e distância: mantenha a constância de avaliações, fotos e postagens.",
      );
    }

    const result: CompareResult = {
      keyword: grid.keyword,
      targetPosition: me?.position ?? null,
      competitor: { id: rival.id, name: theirs.name, position: rival.position },
      alreadyFirst,
      distanceKm: Math.round(haversineKm(mine.location, theirs.location) * 10) / 10,
      rows,
      plano,
    };
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
