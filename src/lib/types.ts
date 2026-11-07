export type LatLng = { latitude: number; longitude: number };

export type PlaceSummary = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating: number | null;
  userRatingCount: number;
  category: string | null;
  mapsUri: string | null;
};

export type Review = {
  rating: number;
  text: string;
  author: string;
  publishTime: string | null;
  relativeTime: string | null;
};

export type PlaceDetails = PlaceSummary & {
  website: string | null;
  phone: string | null;
  hours: string[];
  photosCount: number;
  businessStatus: string | null;
  editorialSummary: string | null;
  /**
   * Descrição escrita pelo dono no Perfil da Empresa (vem da DataForSEO; a Places API não a fornece).
   * undefined = não foi possível verificar; null = o perfil não tem descrição.
   */
  ownerDescription?: string | null;
  /** Dados do Perfil da Empresa vindos da DataForSEO (ausente quando não foi possível consultar). */
  gbp?: {
    isClaimed: boolean | null;
    additionalCategories: string[];
    hasServices: boolean | null;
    hasBookingLink: boolean | null;
    totalPhotos: number | null;
  };
  types: string[];
  reviews: Review[];
  hasPaymentOptions: boolean;
  hasAccessibility: boolean;
  hasParking: boolean;
};

export type CheckStatus = "ok" | "parcial" | "falta";

export type CheckItem = {
  id: string;
  label: string;
  status: CheckStatus;
  points: number;
  max: number;
  /** Por que o item importa (texto fixo, em cinza no layout). */
  why: string;
  /** O que foi encontrado, com valor atual e recomendado. */
  detail: string;
  tip: string;
};

export type Providers = { dataforseo: boolean; claude: boolean };

export type PlaceAnalysis = {
  place: PlaceDetails;
  score: number;
  checklist: CheckItem[];
  isClient?: boolean;
  providers?: Providers;
};

export type FullReview = Review & {
  /** ID da avaliação no Google (vem da DataForSEO). */
  id?: string | null;
  ownerAnswer?: string | null;
  ownerTime?: string | null;
};

/** pendente = falta revisar; aprovada = pronta para ir ao Google; publicada = já está no Google. */
export type QueueStatus = "pendente" | "aprovada" | "publicada" | "ignorada";

export type QueueItem = {
  reviewId: string;
  placeId: string;
  clientName: string;
  author: string;
  rating: number;
  text: string;
  publishedAt: string | null;
  reply: string | null;
  status: QueueStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReviewAnalysis = {
  sentimentoGeral: "positivo" | "misto" | "negativo";
  resumo: string;
  pontosFortes: { tema: string; mencoes: number; exemplo: string }[];
  pontosFracos: { tema: string; mencoes: number; exemplo: string }[];
  palavrasChave: string[];
  sugestoes: string[];
};

export type CategoriesResult = {
  keyword: string;
  source: "dataforseo" | "places";
  target: { primary: string | null; additional: string[] };
  analyzed: number;
  categories: { name: string; primary: number; additional: number; total: number; youHave: boolean }[];
  topics: { topic: string; count: number }[];
};

export type ClientRow = {
  placeId: string;
  name: string;
  address: string;
  category: string | null;
  addedAt: string;
  lastScore: number | null;
  lastAnalysisAt: string | null;
  firstScore: number | null;
  lastTop3Share: number | null;
  /** Respostas com nota a partir deste valor são aprovadas sozinhas; null = todas passam pela fila. */
  autoMinRating: number | null;
  /** Avaliações na fila esperando revisão ou publicação. */
  pendingReplies: number;
};

export type HistorySnapshot = {
  createdAt: string;
  score: number;
  rating: number | null;
  reviews: number;
  photos: number;
};

export type HistoryGrid = {
  id: number;
  createdAt: string;
  keyword: string;
  size: number;
  spacingKm: number;
  provider: "dataforseo" | "places";
  avgRankFound: number | null;
  avgRankOverall: number;
  top3Share: number;
  foundShare: number;
};

/** fixo = pago uma vez (ex.: construção de site); recorrente = mensalidade. */
export type ServiceType = "fixo" | "recorrente";
export type AgencyService = { name: string; description: string; price: number; type: ServiceType };

export type AgencySettings = {
  agencyName: string;
  responsible: string;
  phone: string;
  email: string;
  website: string;
  replyTone: string;
  proposalNotes: string;
  services: AgencyService[];
  /** Tempos de contrato (em meses) usados na simulação de parcelas. */
  contractTerms: number[];
};

export type CompetitorsResult = {
  keyword: string;
  radiusKm: number;
  competitors: (PlaceSummary & { reviewRank: number; isTarget: boolean })[];
  targetFound: boolean;
  avgRating: number | null;
  avgReviews: number;
};

export type GridPoint = {
  lat: number;
  lng: number;
  rank: number | null;
  topIds: string[];
  /** Nomes dos 3 primeiros (só disponível com a DataForSEO). */
  topNames?: string[];
  /** Todos os resultados do ponto, em ordem (até 20 IDs). */
  ids?: string[];
};

export type GridBusiness = {
  id: string;
  name: string;
  category: string | null;
  rating: number | null;
  votes: number;
};

/** Uma linha do "Ranking da região": como cada negócio se saiu no conjunto da grade. */
export type RegionRow = GridBusiness & {
  position: number;
  top3Share: number;
  foundShare: number;
  avgRank: number | null;
  isTarget: boolean;
};

export type CompareStatus = "frente" | "igual" | "atras";

export type CompareResult = {
  keyword: string;
  targetPosition: number | null;
  competitor: { id: string; name: string; position: number };
  /** true quando a empresa já é a 1ª e a comparação é com o 2º colocado. */
  alreadyFirst: boolean;
  distanceKm: number;
  rows: { criterio: string; voce: string; concorrente: string; status: CompareStatus }[];
  plano: string[];
};

/** Atividade recente do perfil (postagens e respostas), consultada na DataForSEO depois que a análise abre. */
export type ProfileActivity = {
  checkedAt: string;
  posts: { count: number; lastDate: string | null; lastImageDate: string | null };
  /** Amostra das avaliações mais recentes; null quando a coleta falhou. */
  reviews: { sample: number; unanswered: number; recent?: FullReview[] } | null;
};

/** Volume de pesquisas estimado por semana (Google Ads mensal × variação diária do Google Trends). */
export type SearchVolumeResult = {
  keyword: string;
  /** Onde o volume foi medido, ex.: "Campinas, SP" (ou o estado/país quando a cidade não tem dados). */
  locationLabel: string;
  locationLevel: "cidade" | "estado" | "país";
  monthly: { year: number; month: number; volume: number } | null;
  /** Estimativa dos últimos 30 dias, com as datas do período. */
  last30: { from: string; to: string; volume: number } | null;
  /** As 4 semanas que formam o último mês, da mais recente para a mais antiga. */
  weeks: { label: string; from: string; to: string; volume: number }[];
};

export type GeogridResult = {
  /** Concorrentes marcados na lista para comparar na grade. */
  compared?: { id: string; name: string }[];
  /** Dados de cada negócio que apareceu na grade (preenchido com a DataForSEO). */
  businesses?: Record<string, GridBusiness>;
  createdAt?: string;
  provider: "dataforseo" | "places";
  keyword: string;
  size: number;
  spacingKm: number;
  points: GridPoint[];
  /** Posição média considerando só os pontos onde a empresa apareceu. */
  avgRankFound: number | null;
  /** Posição média geral; ausência conta como 21. */
  avgRankOverall: number;
  /** % de pontos em que a empresa está no top 3 (Share of Local Voice). */
  top3Share: number;
  foundShare: number;
};
