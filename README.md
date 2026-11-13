# Pré-análise GMN

Portal para agências de SEO local analisarem e acompanharem Perfis da Empresa no Google (Google Meu Negócio).

**[⬇️ Baixar a versão mais recente](https://github.com/Emerson-Cicigliano/pre-analise-gmn/releases/latest)**
(em *Assets*, clique em **Source code (zip)**; não precisa de conta no GitHub)

Para ser avisado das versões novas: **Watch → Custom → Releases → Apply** no topo desta página.

## Como instalar

- **Sozinho, passo a passo:** [INSTALACAO.md](INSTALACAO.md)
- **Com a ajuda do Claude Code:** [INSTALACAO-COM-CLAUDE.md](INSTALACAO-COM-CLAUDE.md)

Em resumo: crie as contas (Google Cloud, Cloudflare e, se quiser, DataForSEO e Anthropic), depois rode
`npm run instalar` dentro da pasta. O portal fica online na sua conta Cloudflare, com a sua senha.

## O que o portal faz

- **Nota de saúde do perfil (0 a 100)**, com cada item classificado como fraco, razoável ou bom e a dica de melhoria.
- **Ranking de concorrentes** por avaliações, com seleção para comparar no mapa.
- **Grade de posição no mapa** por palavra-chave: posição em cada ponto da região, % no top 3, quem lidera.
- **Volume de buscas** da palavra-chave na cidade no último mês, semana a semana.
- **Análise de categorias**: quais os concorrentes usam e quais faltam no perfil.
- **Avaliações**: distribuição, volume por mês, % respondidas, análise com IA e respostas sugeridas.
- **Fila de respostas**: busca as avaliações novas dos clientes, a IA escreve a resposta, você revisa e aprova
  (com regra de aprovação automática por cliente).
- **Clientes** com histórico da nota e das grades.
- **Relatório**, **proposta comercial** (com simulação de contrato) e **card com QR code** para pedir avaliações.

## Integrações

| Serviço | Obrigatório? | O que libera |
|---|---|---|
| Google Places API (New) | Sim | Busca, ficha, concorrentes, grade aproximada |
| Cloudflare (Workers + D1) | Sim (gratuito) | Hospedagem, banco de dados, senha de acesso |
| DataForSEO | Não, recomendado | Ranking real no Maps, todas as avaliações, postagens, volume de busca, fila de respostas |
| Anthropic (Claude) | Não, recomendado | Análise das avaliações e respostas com IA |

O status de cada integração aparece em **Configurações** no portal.

## Comandos

| Comando | Para |
|---|---|
| `npm run instalar` | Instalar ou reconfigurar (cria o banco, guarda as chaves, publica) |
| `npm run deploy` | Publicar de novo depois de uma mudança |
| `npm run dev` | Rodar só no computador, em http://localhost:3000 |
| `npx wrangler secret put APP_SENHA` | Trocar a senha de acesso |

## Limitações

- Alguns itens do perfil não aparecem nos dados públicos do Google (lista de serviços, data das fotos enviadas
  pelo dono). Eles ficam como **verificação manual** na análise.
- A publicação automática das respostas no Google depende de o Google aprovar o seu acesso à Business Profile API
  (veja o final do [INSTALACAO.md](INSTALACAO.md)). Até lá, a fila funciona com copiar e colar.
- Sem a DataForSEO, a grade de posição é uma aproximação feita com a Places API.

## Licença

[MIT](LICENSE). Pode usar, modificar e distribuir, inclusive comercialmente, mantendo o aviso de autoria.
Criado por [Emerson Cicigliano · Audieri](https://www.emersoncicigliano.com).
