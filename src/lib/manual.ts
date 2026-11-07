import type { PlaceDetails, ProfileActivity } from "./types";

// Itens que a API pública não mostra: o usuário confere no perfil e marca. Ficam salvos no navegador.
export const MANUAL_ITEMS = [
  { id: "verificado", label: "Perfil Verificado", why: "Perfis verificados têm mais confiança do Google e podem ser editados pelo dono." },
  { id: "descricao", label: "Descrição do Proprietário", why: "A descrição (até 750 caracteres) conta o que o negócio faz e para quem." },
  { id: "categorias", label: "Categorias Secundárias", why: "Categorias secundárias fazem o perfil aparecer em mais buscas relacionadas." },
  { id: "servicos", label: "Produtos e Serviços", why: "Serviços cadastrados reforçam as palavras que o Google associa ao perfil." },
  { id: "posts", label: "Data da Última Postagem", why: "Postagens frequentes mostram ao Google que o negócio está ativo." },
  { id: "respostas", label: "Avaliações - Avaliações Sem Resposta", why: "Responder mostra aos clientes que o negócio se importa com a opinião deles." },
  { id: "fotos_recentes", label: "Data da Última Mídia pelo Proprietário", why: "Fotos novas no último mês mantêm o perfil atualizado e atraente." },
  { id: "links", label: "Link de Agendamento ou WhatsApp", why: "Um link direto facilita o contato e aumenta as conversões do perfil." },
] as const;

export type ManualState = Record<string, boolean>;

/**
 * Quais itens manuais esconder (porque viraram itens automáticos) e quais já vêm marcados
 * (detectados no perfil pela DataForSEO).
 */
export type AutoResult = { ok: boolean; detail: string };
export type ManualViewResult = { hidden: string[]; auto: Record<string, AutoResult> };

const DAY = 86_400_000;
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY));
// As datas da DataForSEO vêm à meia-noite UTC; sem o fuso UTC elas apareceriam um dia antes no Brasil.
const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export function manualView(place: PlaceDetails, activity?: ProfileActivity | null): ManualViewResult {
  // "descricao" virou o item automático "Descrição da Empresa".
  const hidden = ["descricao"];
  if (place.gbp && place.gbp.isClaimed !== null) hidden.push("verificado");
  if (place.gbp) hidden.push("categorias");

  const auto: Record<string, AutoResult> = {};
  const found = { ok: true, detail: "Detectado automaticamente no perfil." };
  // Serviços e links só contam quando aparecem; vazio não prova que faltam.
  if (place.gbp?.hasServices) auto.servicos = found;
  if (place.gbp?.hasBookingLink) auto.links = found;

  if (activity) {
    const last = activity.posts.lastDate;
    auto.posts = !last
      ? { ok: false, detail: "O perfil não tem nenhuma postagem publicada." }
      : daysSince(last) <= 30
        ? { ok: true, detail: `Última postagem há ${daysSince(last)} dia(s) (${dateBR(last)}).` }
        : { ok: false, detail: `Última postagem há ${daysSince(last)} dias (${dateBR(last)}). Máximo recomendado: 30 dias.` };

    const r = activity.reviews;
    if (r && r.sample > 0) {
      const answered = r.sample - r.unanswered;
      auto.respostas =
        answered / r.sample >= 0.8
          ? { ok: true, detail: `${answered} das ${r.sample} avaliações mais recentes têm resposta do proprietário.` }
          : { ok: false, detail: `${r.unanswered} das ${r.sample} avaliações mais recentes estão sem resposta do proprietário.` };
    }

    // Foto em postagem recente prova que o dono publicou mídia; sem ela, o dono pode ter subido fotos sem postar.
    const img = activity.posts.lastImageDate;
    if (img && daysSince(img) <= 30) {
      auto.fotos_recentes = { ok: true, detail: `O proprietário publicou foto em postagem há ${daysSince(img)} dia(s).` };
    }
  }
  return { hidden, auto };
}

export function manualPendingCount(state: ManualState, view: ManualViewResult): number {
  return MANUAL_ITEMS.filter((m) => !view.hidden.includes(m.id) && !view.auto[m.id] && !state[m.id]).length;
}

export function loadManual(placeId: string): ManualState {
  try {
    return JSON.parse(localStorage.getItem(`manual:${placeId}`) ?? "{}");
  } catch {
    return {};
  }
}

export function saveManual(placeId: string, state: ManualState) {
  try {
    localStorage.setItem(`manual:${placeId}`, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível: fica só em memória */
  }
}
