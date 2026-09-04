"use client";

import { PauseCircle, Play } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperationalPause } from "@/features/safety/operation-pause";

type PauseControlsProps = {
  initialPause: OperationalPause;
};

type PausePayload = {
  ok?: boolean;
  message?: string;
  pause?: OperationalPause;
};

export function PauseControls({ initialPause }: PauseControlsProps) {
  const router = useRouter();
  const [pause, setPause] = useState(initialPause);
  const [saving, setSaving] = useState<"pause" | "resume" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function changePause(paused: boolean) {
    setSaving(paused ? "pause" : "resume");
    setMessage(null);

    try {
      const response = await fetch("/api/settings/pause", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused }),
      });
      const payload = (await response.json().catch(() => ({}))) as PausePayload;

      if (!response.ok || !payload.ok || !payload.pause) {
        setMessage(payload.message ?? "Não foi possível alterar a pausa.");
        return;
      }

      setPause(payload.pause);
      setMessage(payload.message ?? (paused ? "Pesquisa e envio suspensos." : "Pesquisa e envio retomados."));
      router.refresh();
    } catch {
      setMessage("Não foi possível comunicar com o servidor local.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center gap-2 rounded-md border border-coral/30 bg-white px-3 py-2 text-sm font-medium text-coral transition hover:bg-coral hover:text-white disabled:opacity-60"
        disabled={Boolean(saving) || pause.paused}
        onClick={() => void changePause(true)}
        type="button"
      >
        <PauseCircle className="h-4 w-4" />
        {saving === "pause" ? "Suspendendo..." : "Suspender agora"}
      </button>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-mint hover:text-pine disabled:opacity-60"
        disabled={Boolean(saving) || !pause.paused}
        onClick={() => void changePause(false)}
        type="button"
      >
        <Play className="h-4 w-4" />
        {saving === "resume" ? "Retomando..." : "Retomar"}
      </button>
      <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${pause.paused ? "bg-coral text-white" : "border border-pine/20 bg-mint text-pine"}`}>
        <PauseCircle className="h-4 w-4" />
        Pausa geral: {pause.paused ? "ativa" : "inativa"}
      </span>
      {message ? <span className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink/65">{message}</span> : null}
    </div>
  );
}
