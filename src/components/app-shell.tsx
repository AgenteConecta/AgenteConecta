import { CircuitBoard } from "lucide-react";
import Link from "next/link";

const menu = [
  ["Visão Geral", "/"],
  ["Leads", "/leads"],
  ["Treinamento", "#"],
  ["Credenciamento", "#"],
  ["Conversas", "#"],
  ["Prospecção", "#"],
  ["Campanhas", "#"],
  ["Regiões", "#"],
  ["Experimentos", "#"],
  ["WhatsApp", "#"],
  ["Instagram", "#"],
  ["Agentes", "#"],
  ["Claims", "#"],
  ["Jobs", "#"],
  ["Custos", "#"],
  ["Configurações", "#"],
  ["Logs", "#"],
] as const;

export function AppShell({
  active,
  children,
  operationMode = "dry_run",
}: Readonly<{
  active: string;
  children: React.ReactNode;
  operationMode?: string;
}>) {
  const isLive = operationMode === "pilot" || operationMode === "production";
  const operationLabel = operationMode === "pilot" ? "Piloto ativo" : operationMode === "production" ? "Produção ativa" : "Dry-run ativo";
  const operationDetail = isLive ? "CRM ligado. Contato real preparado conforme regras." : "Leitura e CRM ligados. Envio real bloqueado.";

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-ink">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pine text-white">
            <CircuitBoard className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Newtek Sales Engine</div>
            <div className="text-xs text-ink/55">{operationLabel}</div>
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {menu.map(([item, href]) =>
            href === "#" ? (
              <span
                className="whitespace-nowrap rounded-md border border-black/10 bg-[#f7f8f5] px-3 py-2 text-xs font-medium text-ink/35"
                key={item}
              >
                {item}
              </span>
            ) : (
              <Link
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${item === active ? "bg-pine text-white" : "border border-black/10 bg-white text-ink/70"}`}
                href={href}
                key={item}
              >
                {item}
              </Link>
            ),
          )}
        </nav>
      </header>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/10 bg-white px-4 py-5 lg:block">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-pine text-white">
            <CircuitBoard className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Newtek</div>
            <div className="text-xs text-ink/60">Sales Engine</div>
          </div>
        </div>
        <div className="mb-4 rounded-lg border border-black/10 bg-[#f7f8f5] p-3">
          <div className="text-xs font-medium uppercase text-ink/45">Operação</div>
          <div className="mt-2 text-sm font-semibold text-ink">{operationLabel}</div>
          <div className="mt-1 text-xs leading-5 text-ink/60">{operationDetail}</div>
        </div>
        <nav className="space-y-1">
          {menu.map(([item, href]) =>
            href === "#" ? (
              <span className="block cursor-not-allowed rounded-md px-3 py-2 text-sm text-ink/30" key={item}>
                {item}
              </span>
            ) : (
              <Link
                className={`block rounded-md px-3 py-2 text-sm ${item === active ? "bg-mint font-medium text-pine" : "text-ink/70 hover:bg-black/5"}`}
                href={href}
                key={item}
              >
                {item}
              </Link>
            ),
          )}
        </nav>
      </aside>
      <div className="lg:pl-64">{children}</div>
    </main>
  );
}
