import { execFileSync } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const REPO = "be5invis/Iosevka";
const ELEMENT_STYLES = ["Regular", "Italic", "Medium", "MediumItalic", "SemiBold", "SemiBoldItalic", "Bold", "BoldItalic"];
const WINDOWS_FONT_KEY = "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

function fontDir() {
    switch (process.platform) {
        case "win32":
            return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Microsoft", "Windows", "Fonts");
        case "darwin":
            return join(homedir(), "Library", "Fonts");
        default:
            return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "fonts", "Iosevka");
    }
}

const USAGE = `Usage: node install-font.mjs [--version <version>] [--all-styles] [--force] [--dry-run]
       node install-font.mjs --uninstall [--dry-run]

Options:
  --version <version>   Iosevka version to install. Default: the latest release.
  --all-styles          Install all styles. Default: the 8 styles that Element uses.
  --force               Replace font files that are already installed.
  --uninstall           Remove all Iosevka-*.ttf files from the font folder of the current user.
  --dry-run             List the files to install or remove. Change nothing.
  -h, --help            Show this usage and exit.`;

function fail(message) {
    console.error(`${message}\n\n${USAGE}`);
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
    console.log(USAGE);
    process.exit(0);
}

let version;
let allStyles = false;
let force = false;
let uninstall = false;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--version") {
        version = args[++i]?.replace(/^v/, "");
        if (!version) fail("Missing version after --version");
    } else if (arg === "--all-styles") {
        allStyles = true;
    } else if (arg === "--force") {
        force = true;
    } else if (arg === "--uninstall") {
        uninstall = true;
    } else if (arg === "--dry-run") {
        dryRun = true;
    } else {
        fail(`Unknown argument: ${arg}`);
    }
}
if (uninstall && (version || allStyles || force)) fail("Do not use --version, --all-styles or --force with --uninstall");

const HEADERS = { "User-Agent": "element-ayu-themes", "Accept": "application/vnd.github+json" };

async function getRelease() {
    const path = version ? `tags/v${version}` : "latest";
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/${path}`, { headers: HEADERS });
    if (!response.ok) throw new Error(`GitHub returned status ${response.status} for release "${path}".`);
    return response.json();
}

async function download(url, target) {
    const response = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] } });
    if (!response.ok || !response.body) throw new Error(`Download failed with status ${response.status}: ${url}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

function run(command, commandArgs) {
    try {
        execFileSync(command, commandArgs, { stdio: "ignore" });
    } catch (error) {
        if (error.code === "ENOENT") throw new Error(`${command} is not installed. Install it and run the script again.`);
        throw error;
    }
}

function unpack(archive, target) {
    if (process.platform === "win32") {
        run(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-xf", archive, "-C", target]);
    } else if (process.platform === "darwin") {
        run("tar", ["-xf", archive, "-C", target]);
    } else {
        run("unzip", ["-q", archive, "-d", target]);
    }
}

function register(file, target) {
    const displayName = `${basename(file, ".ttf").replace(/-/g, " ")} (TrueType)`;
    run("reg", ["add", WINDOWS_FONT_KEY, "/v", displayName, "/t", "REG_SZ", "/d", target, "/f"]);
}

const WINDOWS_FONT_API = `
    Add-Type -Namespace Win32 -Name FontApi -MemberDefinition '
        [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int AddFontResourceW(string file);
        [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int RemoveFontResourceW(string file);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeoutW(
            IntPtr hWnd, uint msg, UIntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);'
    function Send-FontChange {
        $result = [UIntPtr]::Zero
        [void][Win32.FontApi]::SendMessageTimeoutW([IntPtr]0xffff, 0x1D, [UIntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$result)
    }`;

const powershellList = (items) => items.map((item) => `'${item.replace(/'/g, "''")}'`).join(", ");

function powershell(script) {
    const encoded = Buffer.from(`${WINDOWS_FONT_API}\n${script}`, "utf16le").toString("base64");
    run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded]);
}

function loadWindowsFonts(paths) {
    try {
        powershell(`
            $failed = 0
            foreach ($font in @(${powershellList(paths)})) { if ([Win32.FontApi]::AddFontResourceW($font) -eq 0) { $failed++ } }
            Send-FontChange
            exit $failed`);
    } catch {
        console.warn("Windows could not load some fonts into this session. Sign out and sign in again to use them.");
    }
}

function unloadWindowsFonts(paths) {
    powershell(`
        $paths = @(${powershellList(paths)})
        $names = $paths | ForEach-Object { [IO.Path]::GetFileName($_) }
        $key = '${WINDOWS_FONT_KEY.replace("HKCU\\", "HKCU:\\")}'
        $fonts = Get-Item -Path $key
        foreach ($value in $fonts.Property) {
            if ($names -contains [IO.Path]::GetFileName([string]$fonts.GetValue($value))) {
                Remove-ItemProperty -Path $key -Name $value
            }
        }
        foreach ($path in $paths) {
            for ($i = 0; $i -lt 20 -and [Win32.FontApi]::RemoveFontResourceW($path) -ne 0; $i++) { }
        }
        Send-FontChange`);
}

function remove(files) {
    if (process.platform === "win32") {
        try {
            unloadWindowsFonts(files);
        } catch {
            console.warn(`Could not remove all registry entries in ${WINDOWS_FONT_KEY}.`);
        }
    }
    const result = { removed: 0, failed: 0 };
    for (const file of files) {
        try {
            rmSync(file);
            result.removed++;
        } catch (error) {
            console.warn(`Could not delete ${basename(file)}: ${error.code ?? error.message}. Close the apps that use it.`);
            result.failed++;
        }
    }
    if (process.platform === "linux") {
        if (existsSync(fontDir()) && readdirSync(fontDir()).length === 0) rmSync(fontDir(), { recursive: true });
        try {
            run("fc-cache", ["-f"]);
        } catch {
            console.warn("Could not run fc-cache. Run 'fc-cache -f' to update the font cache.");
        }
    }
    return result;
}

function install(fonts) {
    const dir = fontDir();
    mkdirSync(dir, { recursive: true });
    const result = { installed: 0, skipped: 0, failed: 0 };
    const registered = [];
    for (const font of fonts) {
        const target = join(dir, basename(font));
        if (existsSync(target) && !force) {
            result.skipped++;
        } else {
            try {
                copyFileSync(font, target);
                result.installed++;
            } catch (error) {
                console.warn(`Could not copy ${basename(font)}: ${error.code ?? error.message}. Close the apps that use it.`);
                result.failed++;
                continue;
            }
        }
        if (process.platform === "win32") {
            register(font, target);
            registered.push(target);
        }
    }
    if (registered.length > 0) loadWindowsFonts(registered);
    if (process.platform === "linux") {
        try {
            run("fc-cache", ["-f", dir]);
        } catch {
            console.warn("Could not run fc-cache. Run 'fc-cache -f' to make the new fonts available.");
        }
    }
    return result;
}

function uninstallFonts() {
    const dir = fontDir();
    const files = existsSync(dir)
        ? readdirSync(dir)
              .filter((file) => /^Iosevka-.*\.ttf$/i.test(file))
              .sort()
              .map((file) => join(dir, file))
        : [];
    if (files.length === 0) {
        console.log(`Iosevka is not installed in ${dir}.`);
        return;
    }

    if (dryRun) {
        console.log(`Dry run. The script would remove ${files.length} font files from ${dir}:`);
        for (const file of files) console.log(`  ${basename(file)}`);
        return;
    }

    const { removed, failed } = remove(files);
    console.log(`Removed ${removed} font files from ${dir}.`);
    if (failed > 0) {
        console.log("Run the script again after you close the apps that use the fonts.");
        process.exitCode = 1;
    }
    console.log("Restart Element to stop using Iosevka.");
}

async function installFonts() {
    const release = await getRelease();
    const releaseVersion = release.tag_name.replace(/^v/, "");
    const assetName = `PkgTTF-Iosevka-${releaseVersion}.zip`;
    const asset = release.assets.find((candidate) => candidate.name === assetName);
    if (!asset) throw new Error(`Release ${release.tag_name} has no file named ${assetName}.`);

    const work = mkdtempSync(join(tmpdir(), "iosevka-"));
    try {
        const archive = join(work, asset.name);
        console.log(`Downloading ${asset.name} (${Math.round(asset.size / 1e6)} MB)`);
        await download(asset.browser_download_url, archive);

        const unpacked = join(work, "unpacked");
        mkdirSync(unpacked);
        console.log("Unpacking the archive");
        unpack(archive, unpacked);

        const wanted = new Set(ELEMENT_STYLES.map((style) => `Iosevka-${style}.ttf`));
        const fonts = readdirSync(unpacked, { recursive: true })
            .filter((file) => /\.ttf$/i.test(file))
            .filter((file) => allStyles || wanted.has(basename(file)))
            .map((file) => join(unpacked, file))
            .sort();
        if (fonts.length === 0) throw new Error(`The archive ${asset.name} has no matching font files.`);
        if (!allStyles) {
            const missing = [...wanted].filter((name) => !fonts.some((font) => basename(font) === name));
            if (missing.length > 0) console.warn(`The archive does not have these styles: ${missing.join(", ")}`);
        }

        if (dryRun) {
            console.log(`Dry run. The script would install ${fonts.length} font files to ${fontDir()}:`);
            for (const font of fonts) console.log(`  ${basename(font)}`);
            return;
        }

        const { installed, skipped, failed } = install(fonts);
        console.log(`Installed ${installed} font files to ${fontDir()}.`);
        if (skipped > 0) console.log(`Skipped ${skipped} font files that were already installed. Use --force to replace them.`);
        if (failed > 0) process.exitCode = 1;
        console.log("Restart Element to use Iosevka.");
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

try {
    if (uninstall) {
        uninstallFonts();
    } else {
        await installFonts();
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
