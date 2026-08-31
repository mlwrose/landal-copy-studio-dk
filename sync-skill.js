#!/usr/bin/env node
/**
 * sync-skill.js
 *
 * Reads skill/landal-copy-skill-dk.md and writes netlify/functions/skill-dk.js
 * as a real JS module exporting the skill as a string.
 *
 * Why this exists:
 * Netlify does not bundle arbitrary files referenced via fs.readFileSync at
 * runtime. The skill therefore has to live inside a JS file that Netlify's
 * bundler can see through a normal import. This script keeps the readable
 * markdown as the single source of truth and compiles it into that module.
 *
 * Run before every commit that touches the skill:
 *   node scripts/sync-skill.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "skill", "landal-copy-skill-dk.md");
const OUT = path.join(__dirname, "..", "netlify", "functions", "skill-dk.js");

function escapeForTemplateLiteral(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Cannot find skill source at " + SRC);
    process.exit(1);
  }

  const raw = fs.readFileSync(SRC, "utf8");

  // Guardrail: the skill itself must obey the absolute rules.
  const problems = [];
  if (/\u2014/.test(raw)) problems.push("em dash found in skill source");
  // "Aldrig Landal GreenParks" is the rule itself, so it is allowed.
  const stripped = raw.replace(/aldrig\s+Landal\s+GreenParks/gi, "");
  if (/GreenParks/.test(stripped)) {
    problems.push("GreenParks used as a brand name in skill source");
  }
  if (problems.length) {
    console.error("Skill source failed its own rules:");
    problems.forEach(function (p) {
      console.error("  - " + p);
    });
    process.exit(1);
  }

  const body = escapeForTemplateLiteral(raw);

  const out =
    "// GENERATED FILE. Do not edit by hand.\n" +
    "// Source: skill/landal-copy-skill-dk.md\n" +
    "// Regenerate with: node scripts/sync-skill.js\n" +
    "// Generated: " +
    new Date().toISOString() +
    "\n\n" +
    "const SKILL_DK = `" +
    body +
    "`;\n\n" +
    "module.exports = { SKILL_DK };\n";

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out, "utf8");

  const kb = (Buffer.byteLength(out, "utf8") / 1024).toFixed(1);
  console.log("Wrote " + OUT + " (" + kb + " kB)");
}

main();
