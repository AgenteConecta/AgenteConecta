"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ProspectingAudience } from "@/features/prospecting/audiences";

type EditableAudience = ProspectingAudience & {
  custom?: boolean;
};

type ProspectingLauncherProps = {
  action: (formData: FormData) => void | Promise<void>;
  audiences: ProspectingAudience[];
};

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function ProspectingSubmitStatus() {
  const { pending } = useFormStatus();

  return (
    <>
      {pending ? (
        <div className="rounded-md border border-sky/25 bg-sky/10 px-3 py-3 text-sm font-semibold leading-6 text-ink">
          Buscando perfis no Instagram, qualificando e salvando no banco. Aguarde a conclusão antes de iniciar outra busca.
        </div>
      ) : null}
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-pine px-4 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99] disabled:opacity-65"
        disabled={pending}
      >
        <Search className="h-4 w-4" />
        {pending ? "Pesquisa em andamento..." : "Pesquisar, qualificar e processar lote"}
      </button>
    </>
  );
}

export function ProspectingLauncher({ action, audiences }: ProspectingLauncherProps) {
  const [editableAudiences, setEditableAudiences] = useState<EditableAudience[]>(audiences);
  const [selectedId, setSelectedId] = useState(audiences[0]?.id ?? "auto");
  const [keywords, setKeywords] = useState(audiences[0]?.keywords.join("\n") ?? "");
  const [newKeyword, setNewKeyword] = useState("");
  const [newAudienceName, setNewAudienceName] = useState("");
  const [newAudienceKeywords, setNewAudienceKeywords] = useState("");

  const selectedAudience = useMemo(
    () => editableAudiences.find((audience) => audience.id === selectedId) ?? editableAudiences[0],
    [editableAudiences, selectedId],
  );

  function applyAudience(audience: EditableAudience) {
    setSelectedId(audience.id);
    setKeywords(audience.keywords.join("\n"));
  }

  function addKeyword() {
    const value = newKeyword.trim();
    if (!value) {
      return;
    }

    const current = keywords
      .split(/\n/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!current.some((keyword) => keyword.toLowerCase() === value.toLowerCase())) {
      setKeywords([...current, value].join("\n"));
    }
    setNewKeyword("");
  }

  function addAudience() {
    const label = newAudienceName.trim();
    const addedKeywords = newAudienceKeywords
      .split(/[\n,;]/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!label || addedKeywords.length === 0) {
      return;
    }

    const audience: EditableAudience = {
      id: `custom_${slugify(label) || Date.now()}` as EditableAudience["id"],
      label,
      description: "Público criado nesta busca.",
      keywords: addedKeywords,
      custom: true,
    };

    setEditableAudiences((current) => [...current, audience]);
    setNewAudienceName("");
    setNewAudienceKeywords("");
    applyAudience(audience);
  }

  return (
    <section className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-panel xl:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-pine">
          <Search className="h-4 w-4" />
          Prospecção de leads
        </div>
        <h2 className="mt-2 text-xl font-semibold">Iniciar busca no Instagram</h2>
        <div className="mt-4 grid gap-2">
          {editableAudiences.map((audience) => (
            <button
              className={`rounded-md px-3 py-2 text-left transition hover:bg-mint/70 ${
                audience.id === selectedId ? "border border-pine/30 bg-mint" : "border border-transparent bg-[#f7f8f5]"
              }`}
              key={audience.id}
              onClick={() => applyAudience(audience)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{audience.label}</span>
                {audience.custom ? <span className="text-xs font-medium text-pine">novo</span> : null}
              </div>
              <div className="mt-1 text-xs leading-5 text-ink/60">{audience.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-black/10 bg-[#f7f8f5] p-3">
          <div className="text-sm font-semibold">Adicionar público sugerido</div>
          <div className="mt-3 grid gap-2">
            <input
              className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-pine"
              onChange={(event) => setNewAudienceName(event.target.value)}
              placeholder="Ex.: Designers de interiores"
              value={newAudienceName}
            />
            <textarea
              className="min-h-20 rounded-md border border-black/10 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-pine"
              onChange={(event) => setNewAudienceKeywords(event.target.value)}
              placeholder={"design de interiores\narquitetura decoracao\ncasa inteligente"}
              value={newAudienceKeywords}
            />
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white" onClick={addAudience} type="button">
              <Plus className="h-4 w-4" />
              Adicionar público
            </button>
          </div>
        </div>
      </div>

      <form action={action} className="grid gap-3">
        <input name="audience" type="hidden" value={selectedAudience?.id ?? "auto"} />
        <input name="audienceLabel" type="hidden" value={selectedAudience?.label ?? "Automático recomendado"} />
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase text-ink/45">Público selecionado</span>
          <input className="h-10 rounded-md border border-black/10 bg-[#f7f8f5] px-3 text-sm" readOnly value={selectedAudience?.label ?? ""} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase text-ink/45">Buscas sugeridas ou personalizadas</span>
          <textarea
            className="min-h-36 rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-pine"
            name="keywords"
            onChange={(event) => setKeywords(event.target.value)}
            value={keywords}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-pine"
            onChange={(event) => setNewKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Adicionar outra busca"
            value={newKeyword}
          />
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 px-3 text-sm font-medium" onClick={addKeyword} type="button">
            <Plus className="h-4 w-4" />
            Adicionar busca
          </button>
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase text-ink/45">Perfis por busca</span>
          <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={5} min={1} max={10} name="maxProfiles" type="number" />
        </label>
        <div className="grid gap-3 rounded-md border border-black/10 bg-[#f7f8f5] p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input className="h-4 w-4 accent-pine" defaultChecked name="autoContact" type="checkbox" />
            Contatar automaticamente após qualificar
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase text-ink/45">Score mínimo</span>
              <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={70} min={0} max={100} name="minScore" type="number" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase text-ink/45">Seguidores mínimos</span>
              <input className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={10000} min={0} max={10000000} name="minFollowers" type="number" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase text-ink/45">Lote</span>
              <select className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm" defaultValue={5} name="batchSize">
                <option value={5}>5 leads</option>
                <option value={10}>10 leads</option>
                <option value={15}>15 leads</option>
              </select>
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-black/10 bg-[#f7f8f5] px-3 py-2 text-sm">
          <input className="h-4 w-4 accent-pine" defaultChecked name="runNow" type="checkbox" />
          Executar agora no Chrome conectado
        </label>
        <ProspectingSubmitStatus />
        <div className="rounded-md bg-[#f7f8f5] px-3 py-2 text-xs leading-5 text-ink/60">
          Em dry-run, o sistema pesquisa e registra leads para revisão. Nenhuma DM é enviada.
        </div>
      </form>
    </section>
  );
}
