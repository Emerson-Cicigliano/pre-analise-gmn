# Instalação com o Claude Code

O **Claude Code** é o assistente do Claude que trabalha direto no seu computador: ele roda os comandos, confere os erros
e explica cada passo. Com ele, você só cria as contas e cola as chaves; o resto ele faz.

> Prefere fazer tudo sozinho? Veja **[INSTALACAO.md](INSTALACAO.md)**.

## O que você precisa

- Uma assinatura do Claude (Pro ou Max) em https://claude.ai.
- As contas dos serviços: **Google Cloud** (obrigatória), **Cloudflare** (gratuita), **DataForSEO** e **Anthropic**
  (opcionais, recomendadas). O Claude te guia na criação de cada uma, e o [INSTALACAO.md](INSTALACAO.md) tem os
  links e o passo a passo.

## Passo 1: instalar o Claude (aplicativo)

1. Baixe o aplicativo do Claude para computador em https://claude.ai/download e instale.
2. Entre com a sua conta.
3. Abra a aba **Code** do aplicativo.

## Passo 2: baixar o projeto

1. Abra https://github.com/Subidog-2026/pre-analise-gmn/releases/latest (não precisa de conta no GitHub).
2. Em **Assets**, clique em **Source code (zip)** e descompacte numa pasta, por exemplo `C:\pre-analise-gmn`.

## Passo 3: abrir a pasta no Claude Code

1. Na aba **Code**, escolha a pasta do projeto (a que tem os arquivos `package.json` e `INSTALACAO.md`).
2. Cole a mensagem abaixo e envie:

```
Quero instalar este portal na minha conta. Siga o CLAUDE.md e o INSTALACAO.md.
Me guie passo a passo, um de cada vez, em português e sem termos técnicos.
Comece verificando se o Node.js está instalado.
```

## Como vai ser

O Claude vai:

1. conferir se o **Node.js** está instalado e te ajudar a instalar se faltar;
2. te mostrar, uma de cada vez, como criar as contas e pegar as chaves (Google, DataForSEO, Anthropic, Cloudflare);
3. criar o arquivo **`.env.local`** e abrir para você **colar as chaves nele**, sem precisar colar as chaves no chat;
4. rodar o instalador, que vai **abrir o navegador para você entrar na Cloudflare e clicar em Allow / Permitir**;
5. publicar o portal e te passar o **endereço e a senha**.

Quando o Claude pedir permissão para rodar um comando, leia o que ele vai fazer e aprove.

## Dicas

- **Não cole chaves nem senhas no chat.** Cole direto no arquivo `.env.local` quando o Claude abrir. As chaves
  dão acesso às suas contas pagas.
- Se algo der errado, conte para o Claude o que apareceu na tela. Ele resolve ou te explica o que fazer.
- Depois de instalado, você pode pedir ao Claude mudanças no portal (textos, cores, novos itens) e depois
  "publique de novo".
