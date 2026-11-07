"use client";

import { usePathname, useRouter } from "next/navigation";

/** Volta para a página anterior; sem histórico (link aberto direto), vai para a busca. */
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <button
      type="button"
      className="btn-ghost btn-sm back-btn no-print"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      ← Voltar
    </button>
  );
}
