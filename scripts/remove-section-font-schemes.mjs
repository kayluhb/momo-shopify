#!/usr/bin/env node
/**
 * Removes per-section font_scheme settings; typography is global on <body> instead.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const sectionFiles = globSync(join(root, "sections/*.liquid"));

for (const file of sectionFiles) {
  let content = readFileSync(file, "utf8");
  const original = content;

  content = content.replace(
    /\{%\s*capture section_font\s*%\}\{%\s*render 'section-font-scheme',\s*scheme:\s*section\.settings\.font_scheme\s*%\}\{%\s*endcapture\s*%\}\n?/g,
    "",
  );

  content = content.replace(/\s*\{\{\s*section_font\s*\}\}/g, "");

  content = content.replace(
    /\n\s*\{\s*\n\s*"type":\s*"select",\s*\n\s*"id":\s*"font_scheme",[\s\S]*?\n\s*\},/g,
    "",
  );

  content = content.replace(/\n\s*"font_scheme":\s*"[^"]+",/g, "");

  if (content !== original) {
    writeFileSync(file, content);
    console.log("Updated", file.replace(root + "/", ""));
  }
}

const templateFiles = globSync(join(root, "templates/**/*.json"));

for (const file of templateFiles) {
  let content = readFileSync(file, "utf8");
  const original = content;
  content = content.replace(/\n\s*"font_scheme":\s*"[^"]+",/g, "");
  if (content !== original) {
    writeFileSync(file, content);
    console.log("Updated", file.replace(root + "/", ""));
  }
}

console.log("Done.");
