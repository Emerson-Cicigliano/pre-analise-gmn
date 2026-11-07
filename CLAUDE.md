# Pré-análise GMN: instruções para o Claude Code

Portal de análise de Perfis da Empresa no Google (Google Meu Negócio) para agências de SEO local.
Next.js 16 (App Router) publicado na Cloudflare Workers com OpenNext, banco Cloudflare D1.

## Quem está usando

Normalmente quem abre esta pasta é uma pessoa **não técnica** que recebeu o projeto para instalar na própria conta.
Fale em português do Brasil, sem jargão, um passo de cada vez, e espere a pessoa confirmar antes de seguir.

## Instalação (quando pedirem para instalar)

Siga o [INSTALACAO.md](INSTALACAO.md), nesta ordem:

1. **Node.js:** rode `node -v`. Se faltar, peça para instalar a versão LTS de https://nodejs.org/pt e reabrir o Claude.
2. **Contas:** guie a criação de cada uma com os links dos passos 3 a 6 do INSTALACAO.md. Google Places é
   obrigatória; DataForSEO e Anthropic são opcionais (pergunte se a pessoa quer usar).
3. **Chaves:** copie `.env.example` para `.env.local`, abra o arquivo para a pessoa e peça que ela **cole as chaves
   direto no arquivo** e salve. **Nunca peça para colar chaves ou senhas no chat.** Para `APP_SENHA`, sugira que ela
   escolha uma senha ou deixe em branco (o instalador gera uma).
4. **Instalar:** rode `npm run instalar -- --automatico`. Ele instala as dependências, abre o navegador para o login na
   Cloudflare (`wrangler login`; avise a pessoa para clicar em **Allow**), cria o banco D1, aplica o `schema.sql`,
   envia as chaves como secrets e publica.
5. **Final:** passe o endereço `.workers.dev` e a senha que o instalador mostrou, e explique o primeiro acesso
   (passo 8 do INSTALACAO.md).

Se o instalador falhar, leia a mensagem, resolva a causa (veja "Problemas comuns" no INSTALACAO.md) e rode de novo:
ele reaproveita o que já foi feito.

## Comandos

- `npm run dev`: portal local em http://localhost:3000 (usa uma cópia local do D1).
- `npm run deploy`: publica. Antes, apague a pasta `.next` (evita o erro de fonte do Turbopack) e feche o `npm run dev` (evita `EPERM`).
- `npm run typecheck`: confere os tipos.
- Mudança no banco: crie um arquivo em `migrations/` e aplique com
  `npx wrangler d1 execute <nome-do-banco> --remote --file migrations/<arquivo>.sql` (e `--local` para o banco de teste).

## Regras

- Nunca envie `.env.local` para o GitHub nem mostre o conteúdo dele no chat.
- Senha do portal: secret `APP_SENHA` na Cloudflare (troca com `npx wrangler secret put APP_SENHA`).
- Paleta: fundo areia, textos cinza, dourado só em molduras e detalhes, sempre tema claro (`src/app/globals.css`).

## Estrutura

- `src/lib/places.ts`: Google Places API (busca, ficha, grade aproximada).
- `src/lib/dataforseo.ts`: DataForSEO (ranking real no Maps, avaliações, postagens, volume de busca).
- `src/lib/ai.ts`: Claude (análise de avaliações e respostas).
- `src/lib/db.ts`: banco D1 (clientes, histórico, grades, fila de respostas, configurações).
- `src/lib/checklist.ts` e `src/lib/manual.ts`: regras da nota de saúde.
- `src/app/(app)/*`: páginas (busca, análise, clientes, fila de respostas, configurações).
- `src/app/api/*`: rotas usadas pelas páginas, todas protegidas por senha.
- `scripts/instalar.mjs`: instalador.
