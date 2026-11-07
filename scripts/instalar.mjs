// Instalador da Pré-análise GMN: configura tudo na conta Cloudflare de quem está instalando.
// Uso: npm run instalar   (pode rodar de novo sem problema: o que já foi feito é reaproveitado)
//      npm run instalar -- --automatico   (sem perguntas: usa o .env.local e o nome atual; é o modo do Claude Code)
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = path.join(ROOT, "wrangler.jsonc");
const ENV = path.join(ROOT, ".env.local");
const PLACEHOLDER = "PREENCHIDO-PELO-INSTALADOR";
const KEYS = ["GOOGLE_PLACES_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "ANTHROPIC_API_KEY", "APP_SENHA"];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const step = (n, t) => console.log(`\n━━━ ${n}. ${t} ━━━`);
function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  rl.close();
  process.exit(1);
}

/** Roda um comando mostrando a saída na tela (para os passos interativos). */
function run(cmd) {
  return spawnSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true }).status === 0;
}
/** Roda um comando e devolve o texto da saída. */
function capture(cmd) {
  const r = spawnSync(cmd, { cwd: ROOT, encoding: "utf8", shell: true });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const AUTO = process.argv.includes("--automatico");

async function ask(question, def = "") {
  if (AUTO) {
    console.log(`${question}: ${def ? "(usando o valor do .env.local)" : "(em branco)"}`);
    return def;
  }
  const a = (await rl.question(def ? `${question} [${def}]: ` : `${question}: `)).trim();
  return a || def;
}

function readEnv() {
  if (!fs.existsSync(ENV)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ENV, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

console.log("\nInstalação da Pré-análise GMN na sua conta Cloudflare");

// 1. Dependências
step(1, "Dependências do projeto");
if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
  if (!run("npm install")) fail("Não foi possível instalar as dependências (npm install).");
} else console.log("Já instaladas.");

// 2. Login na Cloudflare
step(2, "Login na Cloudflare");
if (!/associated with the email|You are logged in/i.test(capture("npx wrangler whoami").out)) {
  console.log("Vai abrir o navegador para você entrar na sua conta Cloudflare e clicar em Allow (Permitir).");
  if (!run("npx wrangler login")) fail("Login na Cloudflare não concluído. Rode `npx wrangler login` e tente de novo.");
} else console.log("Já está logado.");

// 3. Nome do portal
step(3, "Nome do portal");
let config = fs.readFileSync(WRANGLER, "utf8");
const currentName = config.match(/"name":\s*"([^"]+)"/)?.[1] ?? "pre-analise-gmn";
let name = await ask("Nome do portal na Cloudflare (letras minúsculas, números e hífen)", currentName);
name = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
if (!name) fail("Nome inválido.");
config = config
  .replace(/"name":\s*"[^"]+"/, `"name": "${name}"`)
  .replace(/"service":\s*"[^"]+"/, `"service": "${name}"`)
  .replace(/"database_name":\s*"[^"]+"/, `"database_name": "${name}"`);

// 4. Banco de dados D1
step(4, "Banco de dados");
let dbId = config.match(/"database_id":\s*"([^"]+)"/)?.[1];
if (!dbId || dbId === PLACEHOLDER) {
  const created = capture(`npx wrangler d1 create ${name}`);
  dbId = created.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
  if (!dbId) {
    // Já existe um banco com esse nome na conta: reaproveita.
    const list = capture("npx wrangler d1 list --json");
    try {
      dbId = JSON.parse(list.out.slice(list.out.indexOf("["))).find((d) => d.name === name)?.uuid;
    } catch {
      /* segue para o erro abaixo */
    }
  }
  if (!dbId) fail(`Não consegui criar o banco "${name}".\n${created.out}`);
  console.log(`Banco criado: ${dbId}`);
} else console.log(`Banco já configurado: ${dbId}`);
config = config.replace(/"database_id":\s*"[^"]+"/, `"database_id": "${dbId}"`);
fs.writeFileSync(WRANGLER, config);

console.log("Criando as tabelas (online e no computador)...");
if (!run(`npx wrangler d1 execute ${name} --remote --yes --file schema.sql`)) fail("Falha ao criar as tabelas no banco online.");
run(`npx wrangler d1 execute ${name} --local --file schema.sql`);

// 5. Chaves das integrações
step(5, "Chaves das integrações");
console.log("Cole cada chave e aperte Enter. Em branco = mantém a atual (entre colchetes) ou pula as opcionais.\n");
const env = readEnv();
env.GOOGLE_PLACES_API_KEY = await ask("Chave da Google Places API (obrigatória)", env.GOOGLE_PLACES_API_KEY ?? "");
if (!env.GOOGLE_PLACES_API_KEY) fail("A chave da Google Places API é obrigatória. Veja o passo 2 do INSTALACAO.md.");
env.DATAFORSEO_LOGIN = await ask("Login da API DataForSEO (opcional)", env.DATAFORSEO_LOGIN ?? "");
env.DATAFORSEO_PASSWORD = env.DATAFORSEO_LOGIN ? await ask("Senha da API DataForSEO", env.DATAFORSEO_PASSWORD ?? "") : "";
env.ANTHROPIC_API_KEY = await ask("Chave da Anthropic / Claude (opcional)", env.ANTHROPIC_API_KEY ?? "");
env.APP_SENHA = await ask("Senha de acesso ao portal", env.APP_SENHA || randomBytes(9).toString("base64url"));

fs.writeFileSync(
  ENV,
  "# Gerado pelo instalador. Não envie este arquivo para ninguém nem para o GitHub.\n" +
    KEYS.map((k) => `${k}=${env[k] ?? ""}`).join("\n") +
    "\n",
);
console.log("Chaves salvas em .env.local (só neste computador).");

// 6. Publicação
step(6, "Publicando o portal na Cloudflare (leva de 2 a 5 minutos, aguarde)");
fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
const deploy = capture("npm run deploy");
if (!deploy.ok) {
  console.log(deploy.out.slice(-3000));
  fail("A publicação falhou. Veja a mensagem acima e rode `npm run instalar` de novo.");
}
const url = deploy.out.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? `https://${name}.<seu-subdominio>.workers.dev`;

console.log("Enviando as chaves para a Cloudflare...");
const tmp = path.join(ROOT, ".secrets.tmp.json");
fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(KEYS.filter((k) => env[k]).map((k) => [k, env[k]]))));
const sent = run(`npx wrangler secret bulk "${tmp}"`);
fs.rmSync(tmp, { force: true });
if (!sent) fail("Não consegui enviar as chaves. Rode `npm run instalar` de novo.");

// 7. Resumo
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔ Pronto! Portal instalado.

  Endereço: ${url}
  Senha:    ${env.APP_SENHA}

Guarde os dois. No primeiro acesso, preencha os dados da agência em Configurações.
Trocar a senha depois:              npx wrangler secret put APP_SENHA
Publicar de novo após uma mudança:  npm run deploy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
rl.close();
