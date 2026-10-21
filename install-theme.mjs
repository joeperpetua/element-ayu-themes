import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function defaultConfigPath() {
    switch (process.platform) {
        case "win32":
            return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Element", "config.json");
        case "darwin":
            return join(homedir(), "Library", "Application Support", "Element", "config.json");
        default:
            return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Element", "config.json");
    }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage: node install-theme.mjs [theme.json...] [--all [dir]] [--config <path>]

Arguments:
  theme.json        Theme files to install.

Options:
  --all [dir]       Install every *.theme.json file in dir.
                    Default dir: ${scriptDir}
  --config <path>   Element config.json to change.
                    Default: ${defaultConfigPath()}
  -h, --help        Show this usage and exit.`;

function fail(message) {
    console.error(`${message}\n\n${USAGE}`);
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
    console.log(USAGE);
    process.exit(0);
}

let configPath = defaultConfigPath();
let allDir;
const requested = [];
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all") {
        const next = args[i + 1];
        const nextIsDir = next && !next.startsWith("-") && existsSync(next) && statSync(next).isDirectory();
        allDir = nextIsDir ? args[++i] : scriptDir;
    } else if (arg === "--config") {
        configPath = args[++i];
        if (!configPath) fail("Missing path after --config");
    } else if (arg.startsWith("-")) {
        fail(`Unknown option: ${arg}`);
    } else {
        requested.push(arg);
    }
}

if (allDir) {
    const found = readdirSync(allDir).filter((file) => file.endsWith(".theme.json")).sort();
    if (found.length === 0) fail(`--all found no *.theme.json files in ${resolve(allDir)}`);
    requested.push(...found.map((file) => join(allDir, file)));
}
const themeFiles = [...new Set(requested.map((file) => resolve(file)))];
if (themeFiles.length === 0) fail("Missing argument: give at least one theme file or --all");

if (!existsSync(dirname(configPath))) {
    console.error(`Folder not found: ${dirname(configPath)}. Start Element once or pass --config.`);
    process.exit(1);
}

const themes = themeFiles.map((file) => {
    const theme = JSON.parse(readFileSync(file, "utf8"));
    if (typeof theme.name !== "string" || !theme.name) throw new Error(`${file} has no theme name`);
    return theme;
});

const exists = existsSync(configPath);
const original = exists ? readFileSync(configPath, "utf8") : "";
const config = exists ? JSON.parse(original) : {};
const indent = original.match(/^([ \t]+)\S/m)?.[1] ?? "    ";

config.setting_defaults ??= {};
const customThemes = (config.setting_defaults.custom_themes ??= []);

for (const theme of themes) {
    const index = customThemes.findIndex((existing) => existing?.name === theme.name);
    if (index === -1) {
        customThemes.push(theme);
        console.log(`Added "${theme.name}"`);
    } else {
        customThemes[index] = theme;
        console.log(`Replaced "${theme.name}"`);
    }
}

if (exists) {
    copyFileSync(configPath, `${configPath}.bak`);
    console.log(`Backed up ${configPath} to ${configPath}.bak`);
}
writeFileSync(configPath, JSON.stringify(config, null, indent) + "\n");
console.log(`Wrote ${configPath}. Restart Element to load the change.`);
