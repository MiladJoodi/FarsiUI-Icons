#!/usr/bin/env node
/**
 * farsiui-icons — copy icon components into your project from the GitHub registry.
 *
 *   npx farsiui-icons add bank-melli
 *   npx farsiui-icons add house --lucide
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderIconTsx, renderLucideIconTsx } from "./render-icon-tsx.mjs";

const DEFAULT_BRAND_REGISTRY =
  process.env.FARSUI_ICONS_REGISTRY ??
  "https://raw.githubusercontent.com/MiladJoodi/FarsiUI-Icons/master/registry";

const DEFAULT_LUCIDE_REGISTRY =
  process.env.FARSUI_ICONS_LUCIDE_REGISTRY ??
  "https://raw.githubusercontent.com/MiladJoodi/FarsiUI-Icons/master/registry/lucide";

async function defaultOutDir(lucide, cwd = process.cwd()) {
  const hasSrc = await fileExists(join(cwd, "src"));
  if (lucide) {
    return hasSrc ? "src/components/lucide" : "components/lucide";
  }
  return hasSrc ? "src/components/icons" : "components/icons";
}

function printHelp() {
  console.log(`Usage:
  npx farsiui-icons add <id-or-name> [id...] [options]

Options:
  --lucide            Use the Lucide stroke-icon registry
  --out <dir>         Output directory
                      (brands: src/components/icons if ./src exists,
                       lucide: src/components/lucide if ./src exists)
  --registry <url>    Registry base URL (overrides default / --lucide)
  --force             Overwrite existing files
  -h, --help          Show help

Examples:
  npx farsiui-icons add bank-melli
  npx farsiui-icons add house --lucide
  npx farsiui-icons add activity zap --lucide
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    return { help: true };
  }
  const cmd = args[0];
  const ids = [];
  let out = null;
  let registry = null;
  let force = false;
  let lucide = false;
  for (let i = 1; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--out") {
      out = args[++i];
      continue;
    }
    if (a === "--registry") {
      registry = args[++i];
      continue;
    }
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a === "--lucide") {
      lucide = true;
      continue;
    }
    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }
    ids.push(a);
  }
  return { help: false, cmd, ids, out, registry, force, lucide };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isLocalRegistry(base) {
  return (
    base.startsWith("file:") ||
    base.startsWith(".") ||
    base.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(base)
  );
}

function resolveRegistryDir(base) {
  if (base.startsWith("file:")) return fileURLToPath(base);
  return resolve(base);
}

async function loadIndex(registry) {
  const base = registry.replace(/\/$/, "");
  if (isLocalRegistry(base)) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(
      await readFile(join(resolveRegistryDir(base), "index.json"), "utf8"),
    );
  }
  return fetchJson(`${base}/index.json`);
}

async function loadIcon(registry, file) {
  const base = registry.replace(/\/$/, "");
  if (isLocalRegistry(base)) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(
      await readFile(join(resolveRegistryDir(base), file), "utf8"),
    );
  }
  return fetchJson(`${base}/${file}`);
}

function resolveEntry(index, query) {
  const q = query.trim();
  return (
    index.icons.find(
      (e) =>
        e.id === q ||
        e.componentName === q ||
        e.componentName.toLowerCase() === q.toLowerCase(),
    ) ?? null
  );
}

async function addIcons({ ids, out, registry, force, lucide }) {
  if (ids.length === 0) {
    throw new Error("Pass at least one icon id (e.g. bank-melli or house)");
  }

  const resolvedRegistry =
    registry ?? (lucide ? DEFAULT_LUCIDE_REGISTRY : DEFAULT_BRAND_REGISTRY);
  const resolvedOut = out ?? (await defaultOutDir(lucide));
  console.log(`Registry: ${resolvedRegistry}`);
  console.log(`Output: ${resolvedOut}`);
  const index = await loadIndex(resolvedRegistry);
  const outDir = resolve(resolvedOut);
  await mkdir(outDir, { recursive: true });

  for (const query of ids) {
    const entry = resolveEntry(index, query);
    if (!entry) {
      console.error(`âœ— Not found: ${query}`);
      process.exitCode = 1;
      continue;
    }
    const icon = await loadIcon(resolvedRegistry, entry.file);
    const fileName = `${icon.componentName}.tsx`;
    const target = join(outDir, fileName);
    if (!force && (await fileExists(target))) {
      console.error(`âœ— Exists (use --force): ${target}`);
      process.exitCode = 1;
      continue;
    }
    const isLucide =
      lucide || (icon.viewBox != null && icon.body != null && !icon.color);
    const source = isLucide ? renderLucideIconTsx(icon) : renderIconTsx(icon);
    await writeFile(target, source, "utf8");
    console.log(`âœ“ ${icon.componentName} â†’ ${target}`);
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.cmd !== "add") {
    console.error(`Unknown command: ${opts.cmd}`);
    printHelp();
    process.exit(1);
  }

  try {
    await addIcons(opts);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
