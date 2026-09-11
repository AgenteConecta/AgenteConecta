"use client";

import { Ban, CheckCircle2, Clock3, Handshake, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectingLane } from "@/features/prospecting/prospecting-lane";

type LeadReviewControlsProps = {
  leadId: string;
  lane: ProspectingLane;
  username: string;
  defaultMessage: string;
};

type ReviewPayload = {
  ok?: boolean;
  message?: string;
};

const actions = [
  { action: "partnership", label: "Parceria", icon: Handshake, tone: "bg-sky text-white" },
  { action: "nurture", label: "Nutrir", icon: Clock3, tone: "bg-[#f1f2ee] text-ink" },
  { action: "reject", label: "Descartar", icon: Trash2, tone: "bg-[#f1f2ee] text-ink" },
  { action: "do_not_contact", label: "Não contatar", icon: Ban, tone: "bg-coral text-white col-span-2" },
] as const;

export function LeadReviewControls({ leadId, lane, username, defaultMessage }: LeadReviewControlsProps) {
  const router = useRouter();
  const [message, setMessage] = useState(defaultMessage);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  function reviewQueueUrl(notice: string) {
    const next = new URL(window.location.href);
    next.pathname = "/leads";
    next.searchParams.set("status", "review_pending");
    next.searchParams.delete("selected");
    next.searchParams.set("notice", notice);
    return `${next.pathname}?${next.searchParams.toString()}`;
  }

  async function submitReview(action: string, approvedMessage = "") {
    setSaving(action);
    setStatus(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          lane,
          username,
          approvedMessage,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ReviewPayload;
      const notice = payload.message ?? (response.ok ? "Lead decidido e removido da fila de revisão." : "Falha ao registrar decisão.");
      setStatus(notice);

      if (response.ok) {
        router.push(reviewQueueUrl(notice));
      }
    } catch {
      setStatus("Não foi possível comunicar com o servidor local.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-black/10 bg-white">
        <div className="border-b border-black/10 px-4 py-3 font-semibold">Abordagem para Instagram</div>
        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase text-ink/45">Mensagem para aprovar</span>
            <textarea
              className="min-h-40 w-full resize-y rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-pine"
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
          </label>
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-pine px-3 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
            disabled={Boolean(saving)}
            onClick={() => void submitReview("approve", message)}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving === "approve" ? "Aprovando..." : "Aprovar abordagem editada"}
          </button>
          {status ? <div className="rounded-md bg-[#f7f8f5] px-3 py-2 text-xs font-semibold leading-5 text-ink/65">{status}</div> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ action, label, icon: Icon, tone }) => (
          <button
            className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60 ${tone}`}
            disabled={Boolean(saving)}
            key={action}
            onClick={() => void submitReview(action)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {saving === action ? "Salvando..." : label}
          </button>
        ))}
      </div>
    </>
  );
}
