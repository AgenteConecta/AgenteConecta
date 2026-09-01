async function loadLocalEnv() {
  const mod = await import("@next/env");
  const loader = mod.loadEnvConfig ?? mod.default?.loadEnvConfig;
  loader(process.cwd());
}

async function main() {
  await loadLocalEnv();
  const { checkInstagramSession } = await import("@/integrations/instagram/browser-worker");
  console.log(JSON.stringify(await checkInstagramSession(), null, 2));
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
