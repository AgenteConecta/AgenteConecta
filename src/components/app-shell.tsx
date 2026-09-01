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
}: Readonly<{
  active: string;
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-ink">
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
        <nav className="space-y-1">
          {menu.map(([item, href]) => (
            <Link
              className={`block rounded-md px-3 py-2 text-sm ${item === active ? "bg-mint font-medium text-pine" : "text-ink/70 hover:bg-black/5"}`}
              href={href}
              key={item}
            >
              {item}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">{children}</div>
    </main>
  );
}
