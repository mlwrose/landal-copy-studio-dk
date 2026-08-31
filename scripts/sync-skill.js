#!/usr/bin/env node
/**
 * sync-skill.js
 *
 * Injects skill/landal-copy-skill-dk.md directly into the SKILL block inside
 * netlify/functions/generate.js, between the sentinel comments.
 *
 * Why in place rather than a separate module:
 * generate.js stays self contained, so the only file Netlify needs is
 * netlify/functions/generate.js. There is no generated file that can go missing
 * from the repo, which is what broke the first several deploys. The markdown
 * remains the readable source of truth and check-rules.js catches drift.
 *
 * Run before every commit that touches the skill:
 *   node scripts/sync-skill.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "skill", "landal-copy-skill-dk.md");
const TARGET = path.join(__dirname, "..", "netlify", "functions", "generate.js");

const START = "/* ===== SKILL START, generated from skill/landal-copy-skill-dk.md ===== */";
const END = "/* ===== SKILL END ===== */";

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
  if (!fs.existsSync(TARGET)) {
    console.error("Cannot find " + TARGET);
    process.exit(1);
  }

  const raw = fs.readFileSync(SRC, "utf8");

  // The skill must obey the absolute rules itself.
  const problems = [];
  if (/\u2014/.test(raw)) problems.push("em dash found in skill source");
  const stripped = raw.replace(/aldrig\s+Landal\s+GreenParks/gi, "");
  if (/GreenParks/.test(stripped)) {
    problems.push("GreenParks used as a brand name in skill source");
  }
  if (problems.length) {
    console.error("Skill source failed its own rules:");
    problems.forEach(function (p) { console.error("  - " + p); });
    process.exit(1);
  }

  const target = fs.readFileSync(TARGET, "utf8");
  const a = target.indexOf(START);
  const b = target.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error("Could not find the SKILL sentinel comments in generate.js.");
    process.exit(1);
  }

  const block =
    START +
    "\nconst SKILL_DK = `" +
    escapeForTemplateLiteral(raw) +
    "`;\n" +
    END;

  const out = target.slice(0, a) + block + target.slice(b + END.length);
  fs.writeFileSync(TARGET, out, "utf8");

  console.log(
    "Injected " + raw.length + " characters of skill into " +
    path.relative(path.join(__dirname, ".."), TARGET)
  );
}

main();
