"use client";

import { ExternalLink, Globe, Instagram, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type BrowserStatus = {
  connected: boolean;
  loggedIn: boolean;
  title: string;
  url: string;
  reason: string | null;
};

type StatusPayload = {
  ok?: boolean;
  message?: string;
  status?: BrowserStatus;
};

const unknownStatus: BrowserStatus = {
  connected: false,
  loggedIn: false,
  title: "",
  url: "",
  reason: "Clique em Verificar conexão.",
};

export function ChromeInstagramControls() {
  const [status, setStatus] = useState<BrowserStatus>(unknownStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<"chrome" | "instagram" | "status" | null>(null);

  async function readStatus() {
    setLoading("status");
    try {
      const response = await fetch("/api/integrations/chrome/connect", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as StatusPayload;
      setStatus(payload.status ?? unknownStatus);
      setMessage(payload.status?.loggedIn ? "Chrome conectado e Instagram logado." : (payload.status?.reason ?? null));
    } catch {
      setStatus({
        ...unknownStatus,
        reason: "Não foi possível verificar o Chrome agora.",
      });
      setMessage("Não foi possível verificar o Chrome agora.");
    } finally {
      setLoading(null);
    }
  }

  async function connectChrome() {
    setLoading("chrome");
    setMessage(null);

    try {
      const response = await fetch("/api/integrations/chrome/connect", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as StatusPayload;
      setMessage(payload.message ?? (response.ok ? "Chrome aberto." : "Não foi possível abrir o Chrome."));
      window.setTimeout(() => void readStatus(), 1800);
    } catch {
      setMessage("Não foi possível abrir o Chrome pelo aplicativo.");
    } finally {
      setLoading(null);
    }
  }

  async function openInstagram() {
    setLoading("instagram");
    setMessage(null);

    try {
      const response = await fetch("/api/integrations/chrome/instagram", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as StatusPayload;
      setStatus(payload.status ?? status);
      setMessage(payload.message ?? (response.ok ? "Instagram aberto." : "Não foi possível abrir o Instagram."));
    } catch {
      setMessage("Não foi possível abrir o Instagram pelo aplicativo.");
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    void readStatus();
  }, []);

  const chromeLabel = status.connected ? "Chrome conectado" : "Chrome desconectado";
  const instagramLabel = status.loggedIn ? "Instagram logado" : "Instagram precisa de login";

  return (
    <section className="mt-4 rounded-lg border border-black/10 bg-[#f7f8f5] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink/70">
            <Globe className="h-4 w-4 text-pine" />
            Conexão de busca
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.connected ? "bg-mint text-pine" : "bg-white text-coral"}`}>
              {chromeLabel}
            </span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.loggedIn ? "bg-pine text-white" : "bg-white text-ink/60"}`}>
              {instagramLabel}
            </span>
          </div>
          <div className="mt-2 text-xs leading-5 text-ink/55">
            {status.loggedIn ? "Pronto para capturar perfis no Instagram." : status.reason ?? "Abra o Chrome conectado e faça login no Instagram."}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-pine px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
            disabled={Boolean(loading)}
            onClick={() => void connectChrome()}
            type="button"
          >
            <Globe className="h-4 w-4" />
            {loading === "chrome" ? "Abrindo..." : "Conectar Chrome"}
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-semibold text-ink/70 transition hover:bg-mint hover:text-pine disabled:opacity-60"
            disabled={Boolean(loading)}
            onClick={() => void openInstagram()}
            type="button"
          >
            <Instagram className="h-4 w-4" />
            {loading === "instagram" ? "Abrindo..." : "Abrir Instagram"}
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-semibold text-ink/70 transition hover:bg-mint hover:text-pine disabled:opacity-60"
            disabled={Boolean(loading)}
            onClick={() => void readStatus()}
            type="button"
          >
            <RefreshCw className={`h-4 w-4 ${loading === "status" ? "animate-spin" : ""}`} />
            Verificar conexão
          </button>
        </div>
      </div>
      {message ? <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink/65">{message}</div> : null}
      {status.connected && status.url ? (
        <a className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-pine" href={status.url} rel="noreferrer" target="_blank">
          <ExternalLink className="h-3.5 w-3.5" />
          Sessão atual: {status.title || status.url}
        </a>
      ) : null}
    </section>
  );
}
