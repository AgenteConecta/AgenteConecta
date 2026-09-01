import nextEnv from "@next/env";
import { checkInstagramSession } from "@/integrations/instagram/browser-worker";

nextEnv.loadEnvConfig(process.cwd());

console.log(JSON.stringify(await checkInstagramSession(), null, 2));
process.exit(0);
