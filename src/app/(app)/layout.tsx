import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import BrandMark from "@/components/BrandMark";
import { authEnabled, isLoggedIn } from "@/lib/auth";

// Todas as páginas deste grupo exigem login.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isLoggedIn())) redirect("/login");

  return (
    <>
      <header className="topbar no-print">
        <a href="/" className="brand">
          <BrandMark />
          Pré-análise GMN
        </a>
        <nav className="nav">
          <a href="/">Buscar</a>
          <a href="/clientes">Clientes</a>
          <a href="/fila">Fila de respostas</a>
          <a href="/configuracoes">Configurações</a>
          {authEnabled() && <a href="/api/logout">Sair</a>}
        </nav>
      </header>
      <main className="container">
        <BackButton />
        {children}
      </main>
    </>
  );
}
