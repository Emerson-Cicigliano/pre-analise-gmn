# Guia de instalação: Pré-análise GMN

Este guia instala o portal **na sua própria conta**. Você terá um endereço próprio, uma senha própria e seus próprios
clientes. Os custos de uso (Google, DataForSEO e IA) são cobrados direto nas suas contas.

Tempo estimado: **de 30 a 60 minutos**, a maior parte criando as contas.

> Prefere que o Claude faça quase tudo por você? Veja **[INSTALACAO-COM-CLAUDE.md](INSTALACAO-COM-CLAUDE.md)**.

---

## O que você vai precisar

| Item | Para que serve | Custo |
|---|---|---|
| Computador com Windows, Mac ou Linux | Rodar a instalação (depois o portal fica online) | — |
| **Node.js** | Programa que roda o instalador | Gratuito |
| Conta **Google Cloud** (com cartão) | Busca de empresas, fichas e mapa | Cota gratuita mensal; depois, por uso |
| Conta **Cloudflare** | Hospedagem do portal e banco de dados | Gratuito |
| Conta **DataForSEO** *(opcional, recomendada)* | Ranking real no mapa, todas as avaliações, postagens | Pré-pago, por uso |
| Conta **Anthropic** *(opcional, recomendada)* | IA: análise de avaliações e respostas | Pré-pago, por uso |

Sem a DataForSEO e sem a Anthropic o portal funciona, mas com menos recursos. Dá para adicioná-las depois rodando o
instalador de novo.

---

## Passo 1: instalar o Node.js

1. Acesse https://nodejs.org/pt e baixe a versão **LTS**.
2. Instale com as opções padrão (Avançar, Avançar, Concluir).
3. Para conferir, abra o **Prompt de Comando** (Windows) ou o **Terminal** (Mac) e digite `node -v`. Deve aparecer
   um número de versão, como `v24.x.x`.

## Passo 2: baixar o projeto

Não precisa de conta no GitHub.

1. Abra https://github.com/Emerson-Cicigliano/pre-analise-gmn/releases/latest
2. Em **Assets**, clique em **Source code (zip)**.
3. Descompacte o arquivo numa pasta fácil de achar, por exemplo `C:\pre-analise-gmn` ou `Documentos/pre-analise-gmn`.

*(Quem já usa Git pode clonar: `git clone https://github.com/Emerson-Cicigliano/pre-analise-gmn.git`. Assim fica mais fácil
receber atualizações; veja o passo 9.)*

**Quer ser avisado das versões novas?** Com uma conta gratuita no GitHub, abra a página do projeto e clique em
**Watch → Custom → Releases → Apply**. A cada versão nova chega um e-mail.

## Passo 3: chave do Google (obrigatória)

1. Acesse https://console.cloud.google.com/ e entre com sua conta Google.
2. No topo, clique no seletor de projeto → **Novo projeto** → dê um nome (ex.: "Pre-analise GMN") → **Criar**.
3. Ative o faturamento: https://console.cloud.google.com/billing → vincule um cartão ao projeto.
   O Google dá uma cota gratuita todo mês; você só paga o que passar dela.
4. Ative a API: https://console.cloud.google.com/apis/library/places.googleapis.com → **Ativar**
   (o nome é **Places API (New)**).
5. Crie a chave: https://console.cloud.google.com/apis/credentials → **Criar credenciais → Chave de API**.
6. Clique na chave criada → em **Restrições de API**, escolha **Restringir chave** → marque só **Places API (New)** → **Salvar**.
7. **Copie a chave** (começa com `AIza...`) e guarde. Você vai colar no instalador.
8. Recomendado: crie um alerta de orçamento em https://console.cloud.google.com/billing/budgets para ser avisado
   se o gasto passar de um valor (ex.: R$ 50).

## Passo 4: DataForSEO (opcional, recomendada)

1. Crie a conta em https://app.dataforseo.com/register. Quando perguntar o tipo de conta, escolha a que se aplica a
   você (pessoal ou empresa).
2. Confirme o e-mail e, se pedirem, a verificação da conta.
3. Adicione créditos em https://app.dataforseo.com/ (menu **Billing** / **Add funds**).
4. Pegue o **login e a senha da API** em https://app.dataforseo.com/api-access.
   Atenção: é a senha da API mostrada nessa página, **não** a senha com que você entra no site.

## Passo 5: Anthropic / Claude (opcional, recomendada)

1. Crie a conta em https://console.anthropic.com/.
2. Adicione créditos em **Settings → Billing**.
3. Crie a chave em **Settings → API Keys → Create Key** e copie (começa com `sk-ant-...`).
   A chave só aparece uma vez: guarde.

*Ter o Claude pago no site (claude.ai) não serve aqui: a API é cobrada separadamente.*

## Passo 6: conta na Cloudflare

1. Crie uma conta gratuita em https://dash.cloudflare.com/sign-up e confirme o e-mail.
2. Só isso. O instalador faz o resto.

## Passo 7: rodar o instalador

1. Abra o **Prompt de Comando** (Windows) ou o **Terminal** (Mac) **dentro da pasta do projeto**:
   - Windows: abra a pasta no Explorador, clique na barra de endereço, digite `cmd` e aperte Enter.
   - Mac: clique com o botão direito na pasta → **Novo Terminal na Pasta**.
2. Digite e aperte Enter:
   ```
   npm run instalar
   ```
3. O instalador vai:
   1. baixar as dependências (pode levar alguns minutos na primeira vez);
   2. abrir o navegador para você **entrar na Cloudflare e clicar em Allow / Permitir**;
   3. perguntar o **nome do portal** (pode aceitar o sugerido apertando Enter);
   4. criar o banco de dados;
   5. pedir as **chaves** dos passos 3, 4 e 5 (cole cada uma e aperte Enter; deixe em branco as que não tiver);
   6. sugerir uma **senha de acesso** ao portal (aperte Enter para aceitar ou digite outra);
   7. publicar o portal.
4. No final aparece o **endereço** (termina em `.workers.dev`) e a **senha**. **Anote os dois.**

Se algo der errado no meio, é só rodar `npm run instalar` de novo: ele continua de onde parou.

## Passo 8: primeiro acesso

1. Abra o endereço e entre com a senha.
2. Vá em **Configurações** e preencha os dados da sua agência (nome, telefone, e-mail, site) e os serviços da proposta.
   Em **Integrações** aparece quais chaves estão funcionando.
3. Em **Buscar**, procure uma empresa, abra a análise e clique em **Adicionar aos clientes**.

---

## Passo 9: receber atualizações

Quando houver uma versão nova:

- **Se você baixou o ZIP:** baixe o ZIP novo em https://github.com/Emerson-Cicigliano/pre-analise-gmn/releases/latest
  e copie para a pasta nova **estes dois arquivos da pasta antiga**:
  `wrangler.jsonc` e `.env.local`. Depois, dentro da pasta nova, rode `npm install` e `npm run deploy`.
- **Se você usou `git clone`:** dentro da pasta, rode `git pull` e depois `npm run deploy`.

Se a atualização trouxer mudanças no banco de dados, ela vem com um arquivo em `migrations/` e a instrução de como
aplicar.

## Domínio próprio (opcional)

Para usar um endereço como `portal.suaempresa.com.br`:

1. O domínio precisa estar na sua conta Cloudflare (**Add a site** no painel da Cloudflare).
2. No arquivo `wrangler.jsonc`, apague as duas barras `//` do começo da linha `"routes"` e troque
   `portal.suaempresa.com.br` pelo endereço que você quer.
3. Rode `npm run deploy`. A Cloudflare cria o endereço e o certificado (HTTPS) sozinha, em alguns minutos.

## Comandos úteis

| Para | Comando |
|---|---|
| Publicar de novo depois de uma mudança | `npm run deploy` |
| Trocar a senha de acesso | `npx wrangler secret put APP_SENHA` (e atualize o `.env.local`) |
| Trocar ou adicionar uma chave | `npm run instalar` (ele pergunta todas de novo) |
| Rodar o portal só no computador, para testes | `npm run dev` e abrir http://localhost:3000 |

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `node` ou `npm` não é reconhecido | Instale o Node.js (passo 1) e **abra um novo** Prompt de Comando |
| `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` | Apague a pasta `.next` e rode o comando de novo |
| `EPERM` ao publicar | Feche o `npm run dev` que estiver aberto e rode `npm run deploy` de novo |
| Integração aparece como "Não configurada" | Rode `npm run instalar` e cole a chave que faltou |
| `PERMISSION_DENIED` do Google | Confira se o faturamento está ativo e se a **Places API (New)** foi ativada (passo 3) |
| DataForSEO pede "verify your account" | Conclua a verificação da conta no site da DataForSEO |

## Segurança

- O arquivo **`.env.local`** guarda as suas chaves e a senha. **Não envie para ninguém** e não coloque no GitHub
  (o projeto já está configurado para ignorá-lo).
- Se alguma chave vazar, apague-a no site do serviço, crie outra e rode `npm run instalar` de novo.

## Resposta automática às avaliações no Google

Hoje o portal escreve as respostas com IA e você publica copiando e colando (página **Fila de respostas**).
Para publicar direto no Google, é preciso pedir ao Google o acesso à **Business Profile API**. O pedido é feito por
você, com o seu site e o Perfil da Empresa **da sua agência verificado há pelo menos 60 dias**:

- Requisitos: https://developers.google.com/my-business/content/prereqs
- Formulário: https://support.google.com/business/contact/api_default
