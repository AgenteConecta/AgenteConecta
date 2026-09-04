"use client";

import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type WhatsAppLeadPanelProps = {
  leadId: string;
  initialPhone?: string | null;
  defaultMessage: string;
  appMode: string;
};

type WhatsAppPayload = {
  ok?: boolean;
  message?: string;
  mode?: "dry_run" | "live";
  result?: string;
};

export function WhatsAppLeadPanel({ leadId, initialPhone, defaultMessage, appMode }: WhatsAppLeadPanelProps) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [message, setMessage] = useState(defaultMessage);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendWhatsApp() {
    setSending(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          message,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as WhatsAppPayload;
      setStatus(payload.message ?? (response.ok ? "WhatsApp processado." : "Falha ao processar WhatsApp."));

      if (response.ok) {
        router.refresh();
      }
    } catch {
      setStatus("Não foi possível comunicar com o servidor local.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <MessageCircle className="h-4 w-4 text-pine" />
          WhatsApp
        </div>
        <span className="rounded-md bg-[#f7f8f5] px-2 py-1 text-xs font-semibold text-ink/60">
          {appMode === "production" ? "envio real" : "preparação"}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase text-ink/45">Número com DDD</span>
          <input
            className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-pine"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ex.: 62998449724"
            value={phone}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase text-ink/45">Mensagem</span>
          <textarea
            className="min-h-36 w-full resize-y rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-pine"
            onChange={(event) => setMessage(event.target.value)}
            value={message}
          />
        </label>
        <button
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-pine px-3 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
          disabled={sending}
          onClick={() => void sendWhatsApp()}
          type="button"
        >
          <Send className="h-4 w-4" />
          {sending ? "Processando..." : appMode === "production" ? "Enviar WhatsApp" : "Preparar WhatsApp"}
        </button>
        {status ? <div className="rounded-md bg-[#f7f8f5] px-3 py-2 text-xs font-semibold leading-5 text-ink/65">{status}</div> : null}
      </div>
    </section>
  );
}
