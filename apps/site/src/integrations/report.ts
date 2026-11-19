/**
 * Reports what the build left out or found broken, for editors. In GitHub Actions: one warning
 * annotation per finding and a table in the run summary; elsewhere a list in the terminal. Each
 * report is also saved to .reports/<name>.json, so a later step can send it to editors.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

export interface Finding {
  /** Page path, or "(no page)". */
  page: string;
  /** What to look for: `block "cards" · field "links[2].url"`. */
  subject: string;
  message: string;
}

export interface ReportTarget {
  env: Record<string, string | undefined>;
  log: (line: string) => void;
  warn: (line: string) => void;
  appendSummary: (path: string, markdown: string) => void;
  save: (name: string, findings: Finding[]) => void;
}

const defaultTarget = (): ReportTarget => ({
  env: process.env,
  log: (line) => console.log(line),
  warn: (line) => console.warn(line),
  appendSummary: (path, markdown) => appendFileSync(path, markdown),
  save: (name, findings) => {
    try {
      mkdirSync(".reports", { recursive: true });
      writeFileSync(`.reports/${name}.json`, JSON.stringify(findings, null, 2));
    } catch (error) {
      console.warn(`[report] Could not save .reports/${name}.json: ${error}`);
    }
  },
});

/** Workflow command data: GitHub reads %, CR and LF as escapes; properties also end at : and ,. */
const escapeData = (v: string) =>
  v.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (v: string) => escapeData(v).replace(/:/g, "%3A").replace(/,/g, "%2C");
const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export const annotation = (title: string, f: Finding) =>
  `::warning title=${escapeProperty(`${title}: ${f.page}`)}::${escapeData(`${f.page} · ${f.subject}: ${f.message}`)}`;

export const summaryMarkdown = (title: string, intro: string, findings: Finding[]) =>
  [
    `## ${title} (${findings.length})`,
    "",
    intro,
    "",
    "| Page | What | Problem |",
    "| --- | --- | --- |",
    ...findings.map((f) => `| ${cell(f.page)} | ${cell(f.subject)} | ${cell(f.message)} |`),
    "",
  ].join("\n");

export function report(
  name: string,
  { title, intro }: { title: string; intro: string },
  findings: Finding[],
  target: ReportTarget = defaultTarget(),
): void {
  target.save(name, findings); // also when empty: a fixed problem must not be reported again
  if (!findings.length) return;
  if (target.env.GITHUB_ACTIONS === "true") {
    for (const f of findings) target.log(annotation(title, f));
    if (target.env.GITHUB_STEP_SUMMARY)
      target.appendSummary(target.env.GITHUB_STEP_SUMMARY, summaryMarkdown(title, intro, findings));
    return;
  }
  target.warn(
    [
      `[${name}] ${title} (${findings.length}):`,
      ...findings.map((f) => `  - ${f.page} · ${f.subject}: ${f.message}`),
    ].join("\n"),
  );
}
