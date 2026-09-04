"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AppMode } from "@/lib/types";

type OperationalModeSwitchProps = {
  currentMode: AppMode;
  action: (formData: FormData) => void | Promise<void>;
};

const modes: Array<{
  value: AppMode;
  label: string;
  tone: string;
  detail: string;
}> = [
  {
    value: "dry_run",
    label: "Seguro",
    tone: "bg-pine text-white",
    detail: "simula sem enviar",
  },
  {
    value: "pilot",
    label: "Piloto",
    tone: "bg-sky text-white",
    detail: "prepara contato real",
  },
  {
    value: "production",
    label: "Produção",
    tone: "bg-coral text-white",
    detail: "envio liberado",
  },
];

export function OperationalModeSwitch({ currentMode, action }: OperationalModeSwitchProps) {
  const [selectedMode, setSelectedMode] = useState<AppMode>(currentMode);
  const [savingMode, setSavingMode] = useState<AppMode | null>(null);
  const selected = modes.find((mode) => mode.value === selectedMode) ?? modes[0];

  return (
    <div className="mt-4 rounded-lg border border-black/10 bg-[#f7f8f5] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink/70">
          <ShieldCheck className="h-4 w-4 text-pine" />
          Modo operacional
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${selected.tone}`}>{selected.label}</span>
          {savingMode ? <span className="text-xs font-semibold text-sky">alterando...</span> : null}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:inline-grid">
          {modes.map((mode) => {
            const active = selectedMode === mode.value;

            return (
              <form
                action={action}
                key={mode.value}
                onSubmit={() => {
                  setSelectedMode(mode.value);
                  setSavingMode(mode.value);
                }}
              >
                <input name="mode" type="hidden" value={mode.value} />
                <button
                  className={`grid min-h-14 w-full min-w-24 content-center rounded-md px-3 py-2 text-center transition active:scale-[0.99] ${
                    active ? `${mode.tone} shadow-panel` : "border border-black/10 bg-white text-ink/70 hover:bg-mint hover:text-pine"
                  }`}
                  type="submit"
                >
                  <span className="text-sm font-semibold">{mode.label}</span>
                  <span className={`text-[11px] leading-4 ${active ? "text-white/85" : "text-ink/50"}`}>{mode.detail}</span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
