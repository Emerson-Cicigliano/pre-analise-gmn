import type { CheckItem, CheckStatus, PlaceDetails } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

type ItemInput = { id: string; label: string; max: number; ratio: number; why: string; detail: string; tip: string };

function item({ id, label, max, ratio, why, detail, tip }: ItemInput): CheckItem {
  const status: CheckStatus = ratio >= 1 ? "ok" : ratio > 0 ? "parcial" : "falta";
  return { id, label, status, points: Math.round(max * ratio * 10) / 10, max, why, detail, tip };
}

function looksKeywordStuffed(name: string): boolean {
  const words = name.trim().split(/\s+/).length;
  return name.length > 45 || words > 7 || /[|•]/.test(name) || /\s[-–]\s.+\s[-–]\s/.test(name);
}

/**
 * Pontuação de saúde da ficha (0–100) usando só dados públicos da Places API.
 * Os pesos refletem os fatores que mais pesam no ranqueamento local: completude,
 * avaliações (volume, nota e recência) e fotos.
 */
export function buildChecklist(p: PlaceDetails, now = Date.now()): CheckItem[] {
  const items: CheckItem[] = [];

  const operational = p.businessStatus === "OPERATIONAL";
  items.push(
    item({
      id: "status",
      label: "Situação do Negócio",
      max: 5,
      ratio: operational ? 1 : 0,
      why: "Perfis marcados como fechados deixam de aparecer para quem procura o serviço.",
      detail: operational
        ? "O negócio está marcado como em funcionamento."
        : `O negócio não está marcado como em funcionamento (situação: ${p.businessStatus ?? "desconhecida"}).`,
      tip: "Confira no painel do Perfil da Empresa se o status está correto.",
    }),
  );

  items.push(
    item({
      id: "categoria",
      label: "Categoria Principal",
      max: 5,
      ratio: p.category ? 1 : 0,
      why: "A categoria principal é o sinal mais forte que o Google usa para decidir em quais buscas o perfil aparece.",
      detail: p.category ? `Categoria principal definida: ${p.category}.` : "Nenhuma categoria principal foi identificada.",
      tip: "Escolha a categoria mais específica possível para o serviço principal.",
    }),
  );

  // Itens que só a DataForSEO informa; sem ela continuam na verificação manual.
  if (p.gbp && p.gbp.isClaimed !== null) {
    items.push(
      item({
        id: "verificado",
        label: "Perfil Verificado",
        max: 6,
        ratio: p.gbp.isClaimed ? 1 : 0,
        why: "Perfis verificados têm mais confiança do Google e só o dono consegue editar as informações.",
        detail: p.gbp.isClaimed
          ? "O perfil é verificado: tem proprietário ou administrador."
          : "O perfil não é verificado: qualquer pessoa pode sugerir alterações e o dono não controla as informações.",
        tip: "Reivindique o perfil em business.google.com e conclua a verificação.",
      }),
    );
  }
  if (p.gbp) {
    const n = p.gbp.additionalCategories.length;
    items.push(
      item({
        id: "categorias_sec",
        label: "Categorias Secundárias",
        max: 4,
        ratio: n >= 2 ? 1 : n === 1 ? 0.5 : 0,
        why: "Categorias secundárias fazem o perfil aparecer em mais buscas relacionadas ao negócio.",
        detail:
          n > 0
            ? `O negócio possui ${n} categoria(s) secundária(s): ${p.gbp.additionalCategories.join(", ")}.`
            : "O negócio não possui categorias secundárias.",
        tip: "Adicione categorias secundárias que descrevam outros serviços do negócio (veja a Análise de categorias).",
      }),
    );
  }

  const stuffed = looksKeywordStuffed(p.name);
  items.push(
    item({
      id: "nome",
      label: "Nome do Negócio",
      max: 3,
      ratio: stuffed ? 0 : 1,
      why: "O nome deve refletir o nome real do negócio, como é conhecido pelos clientes e aparece na fachada.",
      detail: stuffed
        ? `O nome parece ter palavras-chave extras (${p.name.length} caracteres). Isso viola as diretrizes do Google.`
        : `O nome está dentro do padrão. Quantidade de caracteres atual: ${p.name.length}.`,
      tip: "Use o nome real da fachada. Palavras-chave no nome podem suspender o perfil.",
    }),
  );

  items.push(
    item({
      id: "endereco",
      label: "Endereço",
      max: 5,
      ratio: p.address ? 1 : 0,
      why: "O endereço ajuda o Google a mostrar o negócio para quem está por perto.",
      detail: p.address ? "O negócio possui endereço definido." : "O negócio não mostra endereço público.",
      tip: "Negócios de área de atendimento podem ocultar o endereço, mas devem definir as regiões atendidas.",
    }),
  );

  items.push(
    item({
      id: "telefone",
      label: "Número de Telefone",
      max: 8,
      ratio: p.phone ? 1 : 0,
      why: "O telefone é uma das informações-chave: gera o botão de ligar direto do Google.",
      detail: p.phone ? "O negócio possui número de telefone definido." : "O negócio não possui número de telefone definido.",
      tip: "Adicione um telefone local, o mesmo usado no site e nas redes sociais.",
    }),
  );

  items.push(
    item({
      id: "site",
      label: "Website",
      max: 10,
      ratio: p.website ? 1 : 0,
      why: "Um site transmite credibilidade e dá aos clientes mais uma forma de conhecer e contatar a empresa.",
      detail: p.website ? "Endereço do website definido." : "O negócio não possui website definido.",
      tip: "Vincule um site ou uma página de destino da empresa.",
    }),
  );

  items.push(
    item({
      id: "horario",
      label: "Horário de Funcionamento",
      max: 10,
      ratio: p.hours.length ? 1 : 0,
      why: "É uma informação-chave para o cliente saber quando pode entrar em contato ou visitar.",
      detail: p.hours.length ? "Horário de funcionamento definido." : "O negócio não possui horário de funcionamento definido.",
      tip: "Perfis com horário aparecem no filtro “aberto agora”, muito usado nas buscas.",
    }),
  );

  // A Places API devolve no máximo 10 fotos; a DataForSEO traz o total real do perfil.
  const realPhotos = p.gbp?.totalPhotos ?? null;
  const photos = realPhotos ?? p.photosCount;
  items.push(
    item({
      id: "fotos",
      label: "Quantidade de Fotos",
      max: 12,
      ratio: photos >= 10 ? 1 : photos >= 5 ? 0.5 : photos > 0 ? 0.2 : 0,
      why: "Fotos reais mostram o negócio e aumentam a confiança de quem está escolhendo.",
      detail:
        photos >= 10
          ? `O negócio possui quantidade adequada de fotos. Quantidade atual: ${realPhotos ?? "10 ou mais"}.`
          : `O negócio possui poucas fotos. Quantidade atual: ${photos}. Quantidade mínima recomendada: 10.`,
      tip: "Publique fotos da fachada, equipe, ambiente e produtos com frequência.",
    }),
  );

  const n = p.userRatingCount;
  items.push(
    item({
      id: "qtd_avaliacoes",
      label: "Avaliações - Quantidade de Avaliações",
      max: 15,
      ratio: n >= 100 ? 1 : n >= 50 ? 0.8 : n >= 30 ? 0.6 : n >= 10 ? 0.3 : n > 0 ? 0.1 : 0,
      why: "O volume de avaliações é um dos fatores que mais pesam no ranking do Google Maps.",
      detail:
        n >= 100
          ? `O negócio possui quantidade de avaliações suficiente. Quantidade atual: ${n}.`
          : `O negócio possui poucas avaliações. Quantidade atual: ${n}. Quantidade recomendada: 100.`,
      tip: "Crie uma rotina para pedir avaliações (QR code no balcão, link no WhatsApp após o atendimento).",
    }),
  );

  const r = p.rating;
  items.push(
    item({
      id: "nota",
      label: "Avaliações - Média de Avaliações",
      max: 12,
      ratio: r === null ? 0 : r >= 4.7 ? 1 : r >= 4.5 ? 0.85 : r >= 4.3 ? 0.7 : r >= 4.0 ? 0.4 : 0.1,
      why: "Uma boa nota média transmite segurança para o cliente escolher o negócio.",
      detail:
        r === null
          ? "O negócio ainda não tem nota média."
          : r >= 4.7
            ? `A média de avaliações está ótima. Média atual: ${r.toFixed(1)}.`
            : `A média de avaliações pode melhorar. Média atual: ${r.toFixed(1)}. Média recomendada: 4,7 ou mais.`,
      tip: "Responda todas as avaliações, principalmente as negativas, e resolva as causas recorrentes.",
    }),
  );

  const times = p.reviews
    .map((rv) => (rv.publishTime ? Date.parse(rv.publishTime) : NaN))
    .filter((t) => !Number.isNaN(t));
  const newest = times.length ? Math.max(...times) : null;
  const days = newest === null ? null : Math.floor((now - newest) / DAY_MS);
  items.push(
    item({
      id: "recencia",
      label: "Avaliações - Avaliações Recentes",
      max: 8,
      ratio: days === null ? 0 : days <= 30 ? 1 : days <= 90 ? 0.5 : 0.15,
      why: "O Google valoriza um fluxo constante de avaliações novas.",
      detail:
        days === null
          ? "Não foi possível identificar a data da avaliação mais recente."
          : days <= 30
            ? `O negócio recebe avaliações com frequência. Última avaliação: há ${days} dia(s).`
            : `O negócio está há muito tempo sem avaliações novas. Última avaliação: há ${days} dia(s). Máximo recomendado: 30 dias.`,
      tip: "Mire em novas avaliações toda semana.",
    }),
  );

  // A descrição do dono vem da DataForSEO. Sem ela (undefined), não dá para afirmar que falta:
  // o resumo editorial do Google (editorialSummary) só existe em poucos perfis e não é escrito pelo dono.
  const desc = p.ownerDescription;
  const descLen = desc?.trim().length ?? 0;
  items.push(
    item({
      id: "resumo",
      label: "Descrição da Empresa",
      max: 3,
      ratio: desc === undefined ? (p.editorialSummary ? 1 : 0.5) : descLen >= 250 ? 1 : descLen > 0 ? 0.5 : 0,
      why: "Descrever o negócio é a chance de contar aos clientes o que ele faz e o que o torna único.",
      detail:
        desc === undefined
          ? "Não foi possível verificar a descrição do proprietário (configure a DataForSEO). Confira no perfil."
          : descLen >= 250
            ? `O negócio possui descrição com quantidade de caracteres suficiente. Quantidade atual: ${descLen}.`
            : descLen > 0
              ? `A descrição está curta. Quantidade atual: ${descLen} caracteres. Quantidade recomendada: 250 ou mais (máximo 750).`
              : "O negócio não possui descrição preenchida.",
      tip: "Preencha a descrição completa (até 750 caracteres) com os serviços e a região atendida.",
    }),
  );

  const attrs = [p.hasPaymentOptions, p.hasAccessibility, p.hasParking].filter(Boolean).length;
  items.push(
    item({
      id: "atributos",
      label: "Atributos do Negócio",
      max: 4,
      ratio: attrs / 3,
      why: "Atributos como formas de pagamento, acessibilidade e estacionamento ajudam o cliente a decidir.",
      detail:
        attrs === 3
          ? "O negócio possui os atributos principais preenchidos."
          : `O negócio possui ${attrs} de 3 grupos de atributos preenchidos (pagamento, acessibilidade, estacionamento).`,
      tip: "Preencha todos os atributos disponíveis para a categoria no painel do perfil.",
    }),
  );

  return items;
}

export function scoreOf(items: CheckItem[]): number {
  const max = items.reduce((s, i) => s + i.max, 0);
  const got = items.reduce((s, i) => s + i.points, 0);
  return max ? Math.round((got / max) * 100) : 0;
}
