import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

const basePath = process.env.SELLIO_PAGES_BASE_PATH ?? "/sellio";
if (!/^\/?(?:[\w.-]+(?:\/[\w.-]+)*)?$/.test(basePath) || (basePath && !basePath.startsWith("/")) || basePath.split("/").some((part) => [".",".."].includes(part))) {
  throw Error("Invalid Pages base path");
}

const workRoot = resolve(".pages-build");
mkdirSync(workRoot, { recursive: true });
const stage = mkdtempSync(join(workRoot, "site-"));
for (const directory of ["app", "components", "lib", "public"]) mkdirSync(join(stage,directory));
for (const file of [
  "app/page.tsx", "app/layout.tsx", "app/not-found.tsx", "app/globals.css", "app/workspace.css",
  "components/brand.tsx", "components/overview.tsx", "components/landing-interactions.tsx", "components/site-link.tsx", "lib/plans.ts",
]) cpSync(resolve(file),join(stage,file));
cpSync(resolve("pages-preview/icon.png"),join(stage,"public/icon.png"));
for (const route of ["demo","contact","privacy"]) cpSync(resolve("pages-preview",route),join(stage,"app",route),{recursive:true});

writeFileSync(join(stage,"next.config.mjs"),`export default {
  output: "export",
  basePath: ${JSON.stringify(basePath)},
  trailingSlash: true,
  agentRules: false,
  turbopack: {root: ${JSON.stringify(resolve("."))}}
};\n`);
writeFileSync(join(stage,"tsconfig.json"),JSON.stringify({
  compilerOptions: {
    target: "ES2022", lib: ["dom","dom.iterable","esnext"], strict: true, noEmit: true, esModuleInterop: true,
    module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", skipLibCheck: true,
    paths: { "@/*": ["./*"] },
  },
  include: ["next-env.d.ts","**/*.ts","**/*.tsx"],
  exclude:["node_modules"],
}));
execFileSync(process.execPath,[resolve("node_modules/next/dist/bin/next"),"build",stage],{
  stdio:"inherit",
  env:{...process.env,SELLIO_STATIC_PAGES:"true",NEXT_PUBLIC_SELLIO_PAGES_BASE:basePath,NEXT_TELEMETRY_DISABLED:"1"},
});
const output = join(stage,"out");
writeFileSync(join(output,".nojekyll"),"");
cpSync(output,join(workRoot,"out"),{recursive:true});
console.info("Static site: .pages-build/out");
