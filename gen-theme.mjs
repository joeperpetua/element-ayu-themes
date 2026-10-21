import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const USAGE = `Usage: node gen-theme.mjs <vscode-theme> [output]

Arguments:
  vscode-theme   Path or http(s) URL of a VS Code color theme JSON file.
  output         Element theme file to write. Default: <input name>.theme.json

Options:
  -h, --help     Show this usage and exit.`;

function fail(message) {
    console.error(`${message}\n\n${USAGE}`);
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
    console.log(USAGE);
    process.exit(0);
}
const unknown = args.find((arg) => arg.startsWith("-"));
if (unknown) fail(`Unknown option: ${unknown}`);
if (args.length === 0) fail("Missing argument: vscode-theme");
if (args.length > 2) fail(`Too many arguments: ${args.slice(2).join(" ")}`);
const [input, output] = args;

async function loadTheme(source) {
    if (/^https?:\/\//.test(source)) {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`Failed to fetch ${source}: ${response.status}`);
        return response.json();
    }
    return JSON.parse(readFileSync(source, "utf8"));
}

const vscode = await loadTheme(input);
const stem = basename(input.split(/[?#]/)[0]).replace(/\.jsonc?$/, "");
const title = stem
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function parse(color) {
    let digits = color.trim().replace("#", "");
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
    const [r, g, b, a = 255] = digits.match(/../g).map((d) => parseInt(d, 16));
    return { rgb: [r, g, b], a: a / 255 };
}

const hex = (c) => parse(c).rgb;
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const alpha = (c, a) => toHex(hex(c)) + Math.round(a * 255).toString(16).padStart(2, "0");
const flatten = (c, bg) => mix(bg, toHex(hex(c)), parse(c).a);
const lum = (c) => {
    const [r, g, b] = hex(c).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};

function pick(...keys) {
    for (const key of keys) {
        const value = vscode.colors?.[key];
        if (typeof value === "string" && HEX_COLOR.test(value)) return value;
    }
    throw new Error(`Theme defines none of: ${keys.join(", ")}`);
}

function scope(name, fallback) {
    for (const rule of vscode.tokenColors ?? []) {
        const scopes = Array.isArray(rule.scope) ? rule.scope : String(rule.scope ?? "").split(",").map((s) => s.trim());
        const foreground = rule.settings?.foreground;
        if (scopes.includes(name) && typeof foreground === "string" && HEX_COLOR.test(foreground)) return foreground;
    }
    return fallback;
}

const isDark = !/light/i.test(vscode.type ?? "dark");
const editor = toHex(hex(pick("editor.background")));
const opaque = (c) => flatten(c, editor);
const selection = parse(pick("list.activeSelectionBackground", "editor.selectionBackground"));

const ayu = {
    bgDeep: opaque(pick("editorGroupHeader.tabsBackground", "activityBar.background", "sideBar.background", "editor.background")),
    sidebar: opaque(pick("sideBar.background", "editor.background")),
    editor,
    widget: opaque(pick("editorWidget.background", "editor.background")),
    lineHighlight: opaque(pick("editor.lineHighlightBackground", "editorWidget.background", "editor.background")),
    selection: toHex(selection.rgb),
    selectionAlpha: Math.min(selection.a, 0.3),
    ui: opaque(pick("descriptionForeground", "foreground")),
    fg: opaque(pick("editor.foreground", "foreground")),
    accent: opaque(pick("focusBorder", "button.background", "textLink.foreground")),
    error: opaque(pick("errorForeground", "editorError.foreground")),
    added: opaque(pick("gitDecoration.untrackedResourceForeground", "editorGutter.addedBackground", "terminal.ansiGreen")),
    modified: opaque(pick("gitDecoration.modifiedResourceForeground", "editorGutter.modifiedBackground", "terminal.ansiBlue")),
};

const toward = isDark ? "#ffffff" : "#000000";
const emphasize = (c, t) => mix(c, toward, t);
const tint = (c, t) => mix(ayu.editor, c, Math.min(1, t));

function ensure(color, to, backgrounds, target) {
    for (let t = 0; t <= 1; t += 0.005) {
        const c = mix(color, to, t);
        if (Math.min(...backgrounds.map((bg) => contrast(c, bg))) >= target) return c;
    }
    return to;
}

const readable = (c, backgrounds = [ayu.editor, ayu.sidebar], target = 4.5) => ensure(c, toward, backgrounds, target);

const surface = (t) => mix(ayu.editor, ayu.ui, t);
const neutral = {
    100: surface(0.045),
    200: surface(0.08),
    300: surface(0.135),
    400: surface(0.235),
    500: surface(0.38),
    600: surface(0.49),
    700: surface(0.67),
    800: ayu.ui,
};
const textSecondary = ensure(ayu.ui, ayu.fg, [ayu.editor, ayu.sidebar, neutral[300]], 4.5);
const gray = {
    ...neutral,
    900: textSecondary,
    1000: mix(textSecondary, ayu.fg, 0.2),
    1100: mix(textSecondary, ayu.fg, 0.4),
    1200: mix(textSecondary, ayu.fg, 0.6),
    1300: mix(textSecondary, ayu.fg, 0.8),
    1400: ayu.fg,
};

const accentScale = {
    100: tint(ayu.accent, 0.04),
    200: tint(ayu.accent, 0.07),
    300: tint(ayu.accent, 0.1),
    400: tint(ayu.accent, 0.15),
    500: tint(ayu.accent, 0.22),
    600: tint(ayu.accent, 0.3),
    700: tint(ayu.accent, 0.42),
    800: tint(ayu.accent, 0.6),
    900: tint(ayu.accent, 0.8),
    1000: ayu.accent,
    1100: emphasize(ayu.accent, 0.12),
    1200: emphasize(ayu.accent, 0.3),
    1300: emphasize(ayu.accent, 0.55),
    1400: emphasize(ayu.accent, 0.75),
};

const accent = readable(ayu.accent);
const error = readable(ayu.error, [ayu.editor, ayu.sidebar], 5.5);
const success = readable(ayu.added);
const info = readable(ayu.modified);

const syntax = [
    scope("string", ayu.added),
    scope("entity.name.tag", ayu.modified),
    scope("variable.member", ayu.error),
    scope("constant.numeric", ayu.accent),
    scope("string.regexp", ayu.added),
    scope("keyword", ayu.accent),
].map(opaque);
const decorativeBg = syntax.map((c) => tint(c, 0.2));
const decorativeText = syntax.map((c, i) => readable(c, [ayu.editor, ayu.sidebar, decorativeBg[i]]));

function row(strength) {
    for (let t = strength; t > 0; t -= 0.01) {
        const c = tint(ayu.selection, t);
        if (contrast(ayu.fg, c) >= 4.5) return c;
    }
    return ayu.editor;
}

const selectedRow = row(2 * ayu.selectionAlpha);
const hoveredRow = row(1.6 * ayu.selectionAlpha);

const compound = {
    "--cpd-color-theme-bg": ayu.editor,
    ...Object.fromEntries(Object.entries(gray).map(([k, v]) => [`--cpd-color-gray-${k}`, v])),

    "--cpd-color-bg-canvas-default-level-1": ayu.widget,
    "--cpd-color-bg-subtle-secondary-level-0": ayu.sidebar,

    "--cpd-color-text-action-accent": accent,
    "--cpd-color-text-badge-accent": accent,
    "--cpd-color-text-link-external": accent,
    "--cpd-color-bg-action-primary-rest": accent,
    "--cpd-color-bg-action-primary-hovered": emphasize(accent, 0.12),
    "--cpd-color-bg-action-primary-pressed": emphasize(accent, 0.3),
    "--cpd-color-bg-action-primary-disabled": gray[600],
    "--cpd-color-bg-action-secondary-hovered": alpha(ayu.selection, ayu.selectionAlpha),
    "--cpd-color-bg-action-secondary-pressed": alpha(ayu.selection, 1.6 * ayu.selectionAlpha),
    "--cpd-color-bg-accent-rest": accent,
    "--cpd-color-bg-accent-hovered": emphasize(accent, 0.12),
    "--cpd-color-bg-accent-pressed": emphasize(accent, 0.3),
    "--cpd-color-bg-accent-selected": alpha(ayu.accent, 0.1),
    "--cpd-color-bg-badge-accent": alpha(ayu.accent, 0.2),
    "--cpd-color-border-accent-subtle": alpha(ayu.accent, 0.5),
    "--cpd-color-border-accent-primary": accent,
    "--cpd-color-border-focused": accent,
    "--cpd-color-icon-accent-tertiary": accentScale[900],
    "--cpd-color-icon-accent-primary": accent,
    "--cpd-color-gradient-action-stop1": accentScale[1100],
    "--cpd-color-gradient-action-stop2": accentScale[1000],
    "--cpd-color-gradient-action-stop3": accentScale[800],
    "--cpd-color-gradient-action-stop4": accentScale[600],
    "--cpd-color-gradient-subtle-stop1": alpha(ayu.accent, 0.15),
    "--cpd-color-gradient-subtle-stop2": alpha(ayu.accent, 0.12),
    "--cpd-color-gradient-subtle-stop3": alpha(ayu.accent, 0.09),
    "--cpd-color-gradient-subtle-stop4": alpha(ayu.accent, 0.06),
    "--cpd-color-gradient-subtle-stop5": alpha(ayu.accent, 0.03),

    "--cpd-color-text-critical-primary": error,
    "--cpd-color-bg-critical-primary": error,
    "--cpd-color-bg-critical-hovered": emphasize(error, 0.12),
    "--cpd-color-bg-critical-subtle": alpha(ayu.error, 0.12),
    "--cpd-color-bg-critical-subtle-hovered": alpha(ayu.error, 0.18),
    "--cpd-color-bg-badge-critical": alpha(ayu.error, 0.2),
    "--cpd-color-border-critical-primary": error,
    "--cpd-color-border-critical-hovered": emphasize(error, 0.12),
    "--cpd-color-border-critical-subtle": alpha(ayu.error, 0.5),
    "--cpd-color-icon-critical-primary": error,
    "--cpd-color-gradient-critical-stop1": alpha(ayu.error, 0.15),

    "--cpd-color-text-success-primary": success,
    "--cpd-color-bg-success-subtle": alpha(ayu.added, 0.12),
    "--cpd-color-border-success-subtle": alpha(ayu.added, 0.5),
    "--cpd-color-icon-success-primary": success,

    "--cpd-color-text-info-primary": info,
    "--cpd-color-text-badge-info": info,
    "--cpd-color-bg-info-subtle": alpha(ayu.modified, 0.1),
    "--cpd-color-bg-badge-info": alpha(ayu.modified, 0.2),
    "--cpd-color-border-info-subtle": alpha(ayu.modified, 0.5),
    "--cpd-color-icon-info-primary": info,
    "--cpd-color-gradient-info-stop1": alpha(ayu.modified, 0.15),

    ...Object.fromEntries(decorativeText.map((c, i) => [`--cpd-color-text-decorative-${i + 1}`, c])),
    ...Object.fromEntries(decorativeBg.map((c, i) => [`--cpd-color-bg-decorative-${i + 1}`, c])),
};

const colors = {
    "accent-color": accent,
    "primary-color": accent,
    "warning-color": error,
    "alert": error,
    "links": accent,
    "primary-content": ayu.fg,
    "secondary-content": gray[900],
    "tertiary-content": gray[800],
    "quaternary-content": gray[600],
    "quinary-content": gray[400],
    "system": gray[300],
    "system-transparent": alpha(gray[300], 0),
    "background": ayu.editor,
    "panels": gray[300],
    "panels-actions": hoveredRow,
    "sidebar-color": ayu.bgDeep,
    "roomlist-background-color": ayu.sidebar,
    "roomlist-highlights-color": hoveredRow,
    "roomlist-separator-color": gray[300],
    "timeline-background-color": ayu.editor,
    "timeline-text-color": ayu.fg,
    "timeline-text-secondary-color": gray[900],
    "timeline-highlights-color": ayu.lineHighlight,
    "secondary-hairline-color": gray[300],
    "togglesw-off-color": gray[600],
    "room-highlight-color": selectedRow,
    "focus-bg-color": selectedRow,
    "menu-selected-color": hoveredRow,
    "eventbubble-self-bg": tint(ayu.accent, 0.12),
    "eventbubble-others-bg": ayu.widget,
    "eventbubble-bg-hover": ayu.lineHighlight,
    "reaction-row-button-selected-bg-color": tint(ayu.accent, 0.2),
    "icon-button-color": ayu.ui,
    "strong-input-border-color": gray[1100],
    ...Object.fromEntries(Object.entries(accentScale).map(([k, v]) => [`accent-color-${k}`, v])),
};

const theme = {
    name: vscode.name ?? title,
    is_dark: isDark,
    fonts: {
        general: "Iosevka, 'Iosevka Nerd Font', Inter, sans-serif",
        monospace: "'Fira Code', monospace",
    },
    colors,
    compound,
};

const outputPath = output ?? `${stem}.theme.json`;
writeFileSync(outputPath, JSON.stringify(theme, null, 4) + "\n");
console.log(`Wrote ${outputPath} (${theme.name}, ${isDark ? "dark" : "light"})`);

const checks = [
    ["text-primary on canvas", ayu.fg, ayu.editor],
    ["text-primary on room list", ayu.fg, ayu.sidebar],
    ["text-primary on selected row", ayu.fg, selectedRow],
    ["text-secondary on canvas", gray[900], ayu.editor],
    ["text-secondary on room list", gray[900], ayu.sidebar],
    ["text-secondary on subtle bg", gray[900], gray[300]],
    ["accent on canvas", accent, ayu.editor],
    ["on-solid text on accent", ayu.editor, accent],
    ["on-solid text on critical", ayu.editor, error],
    ["mention pill text", ayu.editor, accent],
    ["mention pill text on hover", ayu.editor, emphasize(accent, 0.12)],
    ["own mention pill text", ayu.editor, error],
    ["critical on canvas", error, ayu.editor],
    ["success on canvas", success, ayu.editor],
    ["info on canvas", info, ayu.editor],
    ...decorativeText.map((c, i) => [`decorative-${i + 1} on its bg`, c, decorativeBg[i]]),
];
for (const [label, fg, bg] of checks) {
    const ratio = contrast(fg, bg);
    console.log(label.padEnd(32), fg, bg, ratio.toFixed(2), ratio < 4.5 ? "LOW" : "");
}
