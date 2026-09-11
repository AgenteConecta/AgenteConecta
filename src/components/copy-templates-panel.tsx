import { MessageCircle } from "lucide-react";
import { getCopyTemplates, saveCopyTemplate, type CopyTemplateScope } from "@/features/conversations/copy-settings";

type CopyTemplates = Awaited<ReturnType<typeof getCopyTemplates>>;

function CopyTemplateForm({ scope, title, description, value, returnTo }: { scope: CopyTemplateScope; title: string; description: string; value: string; returnTo: string }) {
  return (
    <form action={saveCopyTemplate} className="grid gap-3 rounded-md border border-black/10 bg-[#f7f8f5] p-4">
      <input name="scope" type="hidden" value={scope} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs leading-5 text-ink/60">{description}</div>
      </div>
      <textarea
        className="min-h-32 rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-pine"
        defaultValue={value}
        name="copy"
        placeholder="Escreva sua copy aqui. Use {nome}, {username} ou @fulano para personalizar automaticamente."
      />
      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-pine px-4 text-sm font-medium text-white transition hover:brightness-95 active:scale-[0.99]">
        <MessageCircle className="h-4 w-4" />
        Salvar copy permanente
      </button>
    </form>
  );
}

export function CopyTemplatesPanel({ templates, returnTo = "/" }: { templates: CopyTemplates; returnTo?: string }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
      <div className="flex items-center gap-2 text-sm font-medium text-pine">
        <MessageCircle className="h-4 w-4" />
        Copy de abordagem
      </div>
      <h2 className="mt-2 text-xl font-semibold">Textos permanentes</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CopyTemplateForm
          description="Usada como fallback para qualquer lead quando não existir uma copy específica do público."
          returnTo={returnTo}
          scope="all"
          title="Padrão para todos"
          value={templates.all}
        />
        <CopyTemplateForm
          description="Usada primeiro para eletricistas e profissionais de elétrica."
          returnTo={returnTo}
          scope="electricians"
          title="Eletricistas"
          value={templates.electricians}
        />
      </div>
    </section>
  );
}
