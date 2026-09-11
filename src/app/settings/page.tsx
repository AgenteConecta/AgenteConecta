import { CopyTemplatesPanel } from "@/components/copy-templates-panel";
import { getCopyTemplates } from "@/features/conversations/copy-settings";
import { getOperationalAppMode } from "@/features/safety/app-mode";
import { AppShell } from "@/components/app-shell";

type SearchParams = Promise<{
  notice?: string;
}>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [appMode, copyTemplates] = await Promise.all([
    getOperationalAppMode().catch(() => "dry_run" as const),
    getCopyTemplates().catch(() => ({ all: "", electricians: "" })),
  ]);

  return (
    <AppShell active="Configurações" operationMode={appMode}>
      <header className="border-b border-black/10 bg-white px-5 py-4 md:px-8">
        <p className="text-sm font-medium text-pine">Configurações</p>
        <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Copy de abordagem</h1>
        {params.notice ? (
          <div className="mt-4 rounded-md border border-pine/20 bg-mint px-4 py-3 text-sm font-medium text-pine">
            {params.notice}
          </div>
        ) : null}
      </header>

      <div className="px-5 py-6 md:px-8">
        <CopyTemplatesPanel templates={copyTemplates} returnTo="/settings" />
      </div>
    </AppShell>
  );
}
