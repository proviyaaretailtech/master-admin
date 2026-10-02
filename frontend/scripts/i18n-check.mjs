#!/usr/bin/env node
/**
 * npm run i18n:check
 *
 * 1. Catalogue integrity (FAILS the run):
 *      - en.json and hi.json define exactly the same keys
 *      - no hi value is empty, or identical to its own key
 *      - {{placeholders}} / <1>tags</1> / $t() nesting match between en and hi
 *      - every literal key used in code (t("a.b"), i18nKey="a.b") exists in en.json
 *        (calls that pass a defaultValue are allowed to be absent)
 * 2. Hard-coded string scan over src/**\/*.tsx (REPORT ONLY, add --strict to fail on it):
 *      - JSX text, {"literal"} children
 *      - title / placeholder / aria-label / alt / label props with literal values
 *      - toast / alert / confirm style calls with literal or template messages
 *      - label-like object properties (label, title, description, message, ...)
 *    and writes docs/I18N_STATUS_master-admin.md with counts per file and the remaining list.
 *
 * Intentional exceptions: put `// i18n-ignore` (or `{/* i18n-ignore *\/}`) on the same or the
 * previous line, wrap a block in `// i18n-ignore-start` / `// i18n-ignore-end`, or list
 * "path:line" / "path" / exact text in scripts/i18n-allowlist.json.
 *
 * Flags: --strict  fail on remaining hard-coded strings
 *        --no-report  do not write the status markdown
 *        --out <file>  status markdown path
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const localesDir = path.join(srcDir, "i18n/locales");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const writeReport = !args.includes("--no-report");
const outIdx = args.indexOf("--out");
const reportPath =
  outIdx >= 0
    ? path.resolve(args[outIdx + 1])
    : path.resolve(root, "../../docs/I18N_STATUS_master-admin.md");

const allowlistFile = path.join(root, "scripts/i18n-allowlist.json");
const allowlist = fs.existsSync(allowlistFile)
  ? JSON.parse(fs.readFileSync(allowlistFile, "utf8"))
  : { files: [], lines: [], texts: [] };

const errors = [];
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

// ---------------------------------------------------------------- catalogues
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function loadCatalogue(lng) {
  const file = path.join(localesDir, `${lng}.json`);
  try {
    return flatten(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (e) {
    errors.push(`${lng}.json: cannot read/parse (${e.message})`);
    return {};
  }
}

const en = loadCatalogue("en");
const hi = loadCatalogue("hi");

const tokens = (s) =>
  [...String(s).matchAll(/\{\{\s*[-\w.]+\s*(?:,[^}]*)?\}\}|<\/?\d+>|\$t\([^)]*\)/g)]
    .map((m) => m[0].replace(/\s+/g, ""))
    .sort()
    .join("|");

const enKeys = Object.keys(en);
const hiKeys = new Set(Object.keys(hi));
const enSet = new Set(enKeys);
const missingInHi = enKeys.filter((k) => !hiKeys.has(k));
const missingInEn = [...hiKeys].filter((k) => !enSet.has(k));
if (missingInHi.length) errors.push(`${missingInHi.length} key(s) in en.json missing from hi.json:\n    ${missingInHi.slice(0, 25).join("\n    ")}${missingInHi.length > 25 ? "\n    ..." : ""}`);
if (missingInEn.length) errors.push(`${missingInEn.length} key(s) in hi.json missing from en.json:\n    ${missingInEn.slice(0, 25).join("\n    ")}${missingInEn.length > 25 ? "\n    ..." : ""}`);

const emptyHi = [];
const keyEchoHi = [];
const placeholderMismatch = [];
let hiSameAsEn = 0;
for (const k of enKeys) {
  if (!hiKeys.has(k)) continue;
  const h = hi[k];
  const e = en[k];
  if (typeof h !== "string" || h.trim() === "") emptyHi.push(k);
  else if (h.trim() === k || h.trim() === k.split(".").pop()) keyEchoHi.push(k);
  if (typeof h === "string" && typeof e === "string") {
    if (tokens(e) !== tokens(h)) placeholderMismatch.push(`${k}\n      en: ${e}\n      hi: ${h}`);
    if (h === e && /[A-Za-z]{3,}/.test(e)) hiSameAsEn++;
  }
}
if (emptyHi.length) errors.push(`${emptyHi.length} empty hi value(s):\n    ${emptyHi.slice(0, 25).join("\n    ")}`);
if (keyEchoHi.length) errors.push(`${keyEchoHi.length} hi value(s) identical to their key:\n    ${keyEchoHi.slice(0, 25).join("\n    ")}`);
if (placeholderMismatch.length) errors.push(`${placeholderMismatch.length} placeholder mismatch(es):\n    ${placeholderMismatch.slice(0, 15).join("\n    ")}`);

// ---------------------------------------------------------------- source scan
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "locales" || entry.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

const hasLetters = (s) => /[A-Za-z]{2,}|[ऀ-ॿ]/.test(s);
const looksLikeCode = (s) =>
  /^[a-z0-9_.:/#@-]+$/.test(s.trim()) || /^(https?:|\/)/.test(s.trim()) || /^[A-Z0-9_]+$/.test(s.trim()) && !/\s/.test(s) && s.length <= 4;

const USER_PROPS = new Set(["title", "placeholder", "aria-label", "alt", "label", "aria-description", "aria-placeholder", "aria-roledescription", "tooltip", "helperText", "emptyText"]);
const LABEL_OBJECT_PROPS = new Set(["label", "title", "description", "message", "subtitle", "heading", "tooltip", "emptyText", "helperText", "hint", "text", "caption", "placeholder"]);
const TOAST_CALLEE = /^(toast(\.\w+)?|alert|confirm|prompt|window\.(alert|confirm|prompt)|showToast|setToast\w*|setError\w*|setSuccess\w*|setNotice\w*|setFeedback\w*|notify\w*)$/;
const T_CALLEE = /^(t|i18n\.t|i18next\.t)$/;

const files = walk(srcDir);
const perFile = [];
const usedKeys = [];

for (const file of files) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  let tCalls = 0;
  let transUses = 0;

  // `// i18n-ignore-start` ... `// i18n-ignore-end` excludes a block (e.g. a static catalogue
  // that is translated by id elsewhere).
  const ignoredRanges = [];
  {
    let start = null;
    lines.forEach((l, i) => {
      if (/i18n-ignore-start/.test(l)) start = i + 1;
      else if (/i18n-ignore-end/.test(l) && start !== null) {
        ignoredRanges.push([start, i + 1]);
        start = null;
      }
    });
  }

  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const ignored = (line) =>
    /i18n-ignore(?!-)/.test(lines[line - 1] || "") ||
    /i18n-ignore(?!-)/.test(lines[line - 2] || "") ||
    ignoredRanges.some(([a, b]) => line >= a && line <= b);

  const add = (node, kind, str) => {
    const value = str.replace(/\s+/g, " ").trim();
    if (!value || !hasLetters(value.replace(/&[a-z#0-9]+;/gi, ""))) return;
    const line = lineOf(node);
    if (ignored(line)) return;
    if (allowlist.files?.includes(rel) || allowlist.lines?.includes(`${rel}:${line}`) || allowlist.texts?.includes(value)) return;
    found.push({ line, kind, text: value.length > 90 ? value.slice(0, 87) + "..." : value });
  };

  // String-literal leaves of an expression: ternary branches, ||/??/&& operands, + concatenation,
  // template literals. Calls (t(...), format(...)) and identifiers are opaque, so already
  // translated values never show up here.
  const literalLeaves = (expr, out = []) => {
    if (!expr) return out;
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr)) return literalLeaves(expr.expression, out);
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) out.push({ node: expr, text: expr.text });
    else if (ts.isTemplateExpression(expr)) out.push({ node: expr, text: [expr.head.text, ...expr.templateSpans.map((x) => "{}" + x.literal.text)].join("") });
    else if (ts.isConditionalExpression(expr)) {
      literalLeaves(expr.whenTrue, out);
      literalLeaves(expr.whenFalse, out);
    } else if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.AmpersandAmpersandToken) {
        literalLeaves(expr.left, out);
        literalLeaves(expr.right, out);
      } else if (op === ts.SyntaxKind.PlusToken) {
        literalLeaves(expr.left, out);
        literalLeaves(expr.right, out);
      }
    }
    return out;
  };

  const calleeName = (expr) => {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) {
      const left = calleeName(expr.expression);
      return left ? `${left}.${expr.name.text}` : expr.name.text;
    }
    return "";
  };

  const inside = (node, predicate) => {
    for (let p = node.parent; p; p = p.parent) if (predicate(p)) return true;
    return false;
  };

  const visit = (node) => {
    // t("a.b", ...) usage
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (T_CALLEE.test(name)) {
        tCalls++;
        const first = node.arguments[0];
        if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
          const callText = node.getText(sf);
          usedKeys.push({ key: first.text, file: rel, line: lineOf(node), hasDefault: /defaultValue/.test(callText) });
        }
      } else if (TOAST_CALLEE.test(name)) {
        for (const a of node.arguments) for (const leaf of literalLeaves(a)) add(leaf.node, "toast", leaf.text);
      }
    }

    // <Trans i18nKey="a.b">
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === "Trans") transUses++;
    }

    // JSX text
    if (ts.isJsxText(node)) {
      const raw = node.text;
      if (raw.trim()) add(node, "text", raw);
    }

    // {"literal"} / {cond ? "A" : "B"} / {x || "fallback"} children
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const leaf of literalLeaves(node.expression)) add(leaf.node, "text", leaf.text);
    }

    // props: title="..." placeholder="..." aria-label="..."
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attr = node.name.getText(sf);
      const init = node.initializer;
      if (attr === "i18nKey" && ts.isStringLiteral(init)) {
        usedKeys.push({ key: init.text, file: rel, line: lineOf(node), hasDefault: false });
      } else if (USER_PROPS.has(attr)) {
        if (ts.isStringLiteral(init)) {
          if (!looksLikeCode(init.text)) add(init, `prop:${attr}`, init.text);
        } else if (ts.isJsxExpression(init) && init.expression) {
          for (const leaf of literalLeaves(init.expression)) add(leaf.node, `prop:${attr}`, leaf.text);
        }
      }
    }

    // label-like object properties with literal values (module-level constants, option lists)
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      const pname = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
      const v = node.initializer;
      if (LABEL_OBJECT_PROPS.has(pname) && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v))) {
        // skip when it is inside a t() call, a console call, or a defaultValue-style options bag
        const skip = inside(node, (p) => ts.isCallExpression(p) && (T_CALLEE.test(calleeName(p.expression)) || /^console\./.test(calleeName(p.expression))));
        if (!skip && !looksLikeCode(v.text)) add(v, `object:${pname}`, v.text);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  perFile.push({ rel, found, tCalls, transUses });
}

// used literal keys must exist
const isPluralBase = (k) => enSet.has(`${k}_one`) || enSet.has(`${k}_other`) || enSet.has(`${k}_zero`);
const hasPrefix = (k) => enKeys.some((e) => e.startsWith(`${k}.`));
const missingUsed = usedKeys.filter((u) => !enSet.has(u.key) && !isPluralBase(u.key) && !u.hasDefault && !hasPrefix(u.key));
if (missingUsed.length) {
  errors.push(
    `${missingUsed.length} key(s) used in code but missing from en.json:\n    ${missingUsed
      .slice(0, 30)
      .map((u) => `${u.key}  (${u.file}:${u.line})`)
      .join("\n    ")}${missingUsed.length > 30 ? "\n    ..." : ""}`
  );
}


const GUIDE = `# i18n — Master Admin web (English + Hindi)

Strategy: \`docs/I18N.md\` · Terms: \`docs/I18N_GLOSSARY.md\` (additions under \`## Added by master-admin\`) · Review tracker: \`docs/I18N_REVIEW.md\`.
App: \`Master Admin /frontend\` (React 18, Vite, TypeScript, Tailwind, i18next + react-i18next). Code lives in \`src/i18n/\`.

## How a screen uses text (conventions — read before building or connecting a Figma screen)

1. **No user-visible string in a screen.** Every word comes from \`src/i18n/locales/en.json\` + \`hi.json\`, namespaced by feature: \`common, status, errors, auth, nav, settings, orgs, locations, plans, packs, addons, modules, roles, users\`.
2. **Components:** \`const { t } = useTranslation();\` then \`t("plans.list.title")\`. Placeholders \`{{name}}\`, never string concatenation (Hindi word order differs). Plurals: \`t("x.count", { count })\` with \`x.count_one\` + \`x.count_other\` in BOTH files. Text with bold/links inside: \`<Trans i18nKey="..." values={{ name }} components={{ b: <b /> }} />\`.
3. **Add a string:** add the key to BOTH \`en.json\` and \`hi.json\` (same key path, same \`{{placeholders}}\`), then run \`npm run i18n:check\`. Keys are a stable identity grouped by screen (\`plans.editor.saveDraft\`), not the English sentence. Reuse \`common.*\` for shared words (Save, Cancel, ...). English wording stays exactly what the design says; Hindi follows the glossary.
4. **Option lists / constants hold keys or codes, not words.** Translate at render time inside the component (\`t(item.labelKey)\`), never call \`t()\` at module load: the text must follow a language switch.
5. **Status words are codes.** Keep the API value (\`"Active"\`, \`"Draft"\`, \`"Cloud Kitchen"\`) for requests, comparisons, colours and \`<option value>\`; show it with \`statusLabel(t, raw)\`, \`locationTypeLabel(t, raw)\`, \`cadenceLabel(t, raw)\` or \`codeLabel(t, "roles.scope", raw)\` (\`src/i18n/labels.ts\`). Unknown codes show a humanised label, never the raw code. Add new known codes to the catalogue (\`status.*\`).
6. **API errors are codes.** \`catch (err) { setMsg(localizeError(err, "plans.toast.saveFailed")) }\` (\`src/i18n/errors.ts\`). The axios layer throws \`ApiError\` (\`message\` = server text, plus \`errorCode\`, \`status\`, \`fieldErrors\`). Mapping order: network -> known server message -> \`errors.code.<CODE>\` -> unknown code falls back to the server message -> \`errors.status.<status>\` -> \`errors.generic\`. Keep the ERROR in state (not the finished string) when it stays on screen, so it re-translates after a switch. New backend codes: add \`errors.code.<CODE>\` (or a row in \`SERVER_MESSAGES\` for code-less messages).
7. **Money, numbers, dates, times:** \`const f = useFormat();\` -> \`f.money(1499)\` ₹1,499 · \`f.money(123456.5)\` ₹1,23,456.50 · \`f.moneyFrom(plan, "price")\` (uses \`price_minor\` when the API sends it) · \`f.moneyMinor(12345650)\` · \`f.number(n)\` · \`f.date(iso)\` · \`f.time(iso)\` · \`f.dateTime(iso)\` · \`f.relative(iso)\`. All dates show Asia/Kolkata. Latin digits in Hindi; Devanagari digits are an opt-in under Settings > Language (off by default). Plain functions for non-hook code: \`src/i18n/format.ts\`. Never use \`toLocaleString\`, \`toLocaleDateString\` or \`"₹" + n\` in a screen. English dates keep the existing "Sep 16, 2026" style (one table in \`format.ts\` to change).
8. **Layout:** no fixed widths/heights on buttons, table headers, tabs or badges (\`min-w-*\`/\`min-h-*\`); let labels wrap; no \`whitespace-nowrap\` on text that can be Hindi; keep \`truncate\` for user data (emails, names) only; no \`leading-none\` on text. \`index.css\` already raises line height, removes letter-spacing and enlarges 9-11 px text under \`:lang(hi)\`.
9. **Check your work:** \`npm run i18n:check\` (parity, placeholders, every literal \`t("key")\` exists, hard-coded text scan -> this file). Then switch to **हिन्दी** and to the dev-only pseudo-locale **en-XA** (Settings > Language, dev builds only): anything still plain English there is hard-coded; any clipped label needs a layout fix. Mark a deliberate literal with \`// i18n-ignore\`, a block with \`// i18n-ignore-start\` ... \`// i18n-ignore-end\`, or list it in \`scripts/i18n-allowlist.json\`.
10. **Hindi:** glossary terms exactly; formal "आप"; sentence case; acronyms (UPI, GST, KYC, CSV, ID) stay Latin; short buttons stay short. Machine-drafted and flagged needs-review until a native speaker signs off.

## Language switching and the lazy loader

- **Registry** \`src/i18n/registry.ts\`: one row per language (code, native name, English name, preview line, whether it needs the Devanagari font). Adding a language = one catalogue file + one loader in \`src/i18n/loader.ts\` + one registry row. The preview line lives in the registry (not the catalogue) because it must be readable before that language is downloaded.
- **Bundled vs lazy:** only \`en.json\` is in the main bundle (source language and missing-key fallback: a missing or empty Hindi key shows English, never a blank or a key name; a failed download can never blank the UI). \`hi.json\` is a separate chunk (~50 kB, ~19 kB gzip) fetched with a dynamic \`import()\`; so is the Devanagari font (two self-hosted woff2 files, ~100 kB, registered through the FontFace API, regular + bold; nothing comes from a CDN).
- **Start-up, no flash** (\`src/i18n/bootstrap.ts\`, \`main.tsx\`): the saved language (\`localStorage["master-admin.language"]\`, else the browser language, else \`en\`) is read synchronously BEFORE the first render. If it is not English its catalogue + font load first while the text-free splash in \`index.html\` stays up, then the app renders once, already in that language. If that fails or takes more than 8 s the app starts in English (never blank) and keeps the saved choice for the next visit. After first paint, the other languages are prefetched in browser idle time (skipped on Save-Data / 2g).
- **Switching** (\`src/i18n/language-store.ts\`, UI in \`components/i18n/LanguageRadioGroup.tsx\`, shown in Settings > Language and on the login page; also reachable from the header profile menu -> Language): the CURRENT language stays on screen while the new one loads; only the chosen row shows an inline spinner. A language counts as loaded only when BOTH its catalogue and its font are ready; then ONE synchronous commit (\`flushSync\`) swaps text, \`<html lang>\`, number/date formats. No reload, no router remount, form state/scroll/focus untouched. 8 s timeout or any failure keeps the current language and shows an inline error with Retry on that row. A click on the row that is already loading is ignored; the last click wins (a slower earlier load is cached but never applied; choosing the active language cancels a pending one). Hover/focus on a row prefetches it so the click is usually instant. The choice is persisted and announced in a polite \`aria-live\` region in the NEW language ("भाषा हिन्दी में बदली गई"). The picker is a keyboard radio group (arrows/Home/End move focus and prefetch, Space/Enter selects).
- **Fonts and CSS** (\`src/index.css\`): Noto Sans Devanagari under \`:lang(hi)\`, line-height 1.6, letter-spacing normal, 9-11 px text bumped one step, \`overflow-wrap: break-word\` on buttons/cells.
- **Not done here:** the preference is not yet stored server-side (\`user_preferences.locale\`): the Master Admin API has no such field. \`selectLanguage()\` is the single place to add that call.
`;

// ---------------------------------------------------------------- report
const totalFound = perFile.reduce((n, f) => n + f.found.length, 0);
const totalT = perFile.reduce((n, f) => n + f.tCalls + f.transUses, 0);
const today = new Date().toLocaleDateString("en-CA");

if (writeReport) {
  const rows = perFile
    .filter((f) => f.tCalls + f.transUses + f.found.length > 0)
    .sort((a, b) => b.found.length - a.found.length || a.rel.localeCompare(b.rel));
  let md = GUIDE + `\n<!-- BEGIN GENERATED (npm run i18n:check) -->\n\n# Generated status\n\nGenerated by \`npm run i18n:check\` on ${today}. Do not edit this block by hand.\n\n`;
  md += `## Summary\n\n`;
  md += `| Measure | Count |\n|---|---|\n`;
  md += `| Catalogue keys (en) | ${enKeys.length} |\n| Catalogue keys (hi) | ${hiKeys.size} |\n`;
  md += `| Hindi values identical to English (acronyms, brand names; check by eye) | ${hiSameAsEn} |\n`;
  md += `| Translation call sites (\`t()\` + \`<Trans>\`) in src | ${totalT} |\n`;
  md += `| Likely hard-coded user-visible strings remaining | ${totalFound} |\n`;
  md += `| Files scanned | ${perFile.length} |\n`;
  md += `| Catalogue errors | ${errors.length} |\n\n`;
  md += `Hindi is machine-drafted and flagged \`needs_review\` (see docs/I18N_REVIEW.md); it is not approved for customers.\n\n`;
  md += `## Per file\n\n| File | t() / Trans call sites | Hard-coded remaining |\n|---|---|---|\n`;
  for (const f of rows) md += `| ${f.rel} | ${f.tCalls + f.transUses} | ${f.found.length} |\n`;
  md += `\n## Remaining hard-coded strings\n\n`;
  if (totalFound === 0) md += `None found.\n`;
  else {
    md += `Kinds: \`text\` JSX text, \`prop:x\` attribute, \`toast\` alert/toast/set-message call, \`object:x\` label-like property. Mark a deliberate exception with \`// i18n-ignore\` or add it to scripts/i18n-allowlist.json.\n\n`;
    for (const f of perFile.filter((x) => x.found.length)) {
      md += `### ${f.rel} (${f.found.length})\n\n`;
      for (const s of f.found) md += `- L${s.line} \`${s.kind}\` ${JSON.stringify(s.text)}\n`;
      md += `\n`;
    }
  }
  md += `<!-- END GENERATED -->\n`;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md);
}

console.log(`i18n:check  en ${enKeys.length} keys · hi ${hiKeys.size} keys · ${totalT} t()/Trans call sites · ${totalFound} hard-coded string(s) remaining in ${perFile.filter((f) => f.found.length).length} file(s)`);
if (writeReport) console.log(`  status written to ${path.relative(process.cwd(), reportPath)}`);

if (errors.length) {
  console.error(`\ni18n:check FAILED\n`);
  for (const e of errors) console.error(`  - ${e}\n`);
  process.exit(1);
}
if (strict && totalFound > 0) {
  console.error(`i18n:check --strict: ${totalFound} hard-coded string(s) remain (see status report).`);
  process.exit(1);
}
console.log("i18n:check OK");
