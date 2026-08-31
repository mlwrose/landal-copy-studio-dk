#!/usr/bin/env node
/**
 * check-rules.js
 * Pre-commit sanity check. Fails loudly if an absolute rule is broken anywhere
 * in the repo, or if the generated skill module has drifted from the markdown.
 *   node scripts/check-rules.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const FILES = [
  "index.html",
  "netlify/functions/generate.js",
  "netlify/functions/skill-dk.js",
  "skill/landal-copy-skill-dk.md",
  "README.md"
];

let failed = false;
function bad(msg) { console.error("  FAIL  " + msg); failed = true; }

FILES.forEach(function (rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { bad(rel + " is missing"); return; }
  const src = fs.readFileSync(p, "utf8");

  const em = src.split("\n").reduce(function (acc, line, i) {
    if (/[\u2014]/.test(line)) acc.push(i + 1);
    return acc;
  }, []);
  if (em.length) bad(rel + " has an em dash on line(s) " + em.join(", "));

  // GreenParks is banned as a brand name, but the rule about it has to be
  // stateable. A line mentioning it is allowed only if it is clearly saying
  // not to use it, or is the detection logic itself.
  const ALLOWED = /never|aldrig|\bnot\b|\bno\b|banned|forbid|fail|flag|check|rule|detect|test\(/i;
  src.split("\n").forEach(function (line, i) {
    if (/GreenParks/.test(line) && !ALLOWED.test(line)) {
      bad(rel + " uses GreenParks as a brand name on line " + (i + 1));
    }
  });

  if (/sk-ant-/.test(src)) bad(rel + " appears to contain a hardcoded API key");
  if (/readFileSync\(/.test(src) && rel.indexOf("netlify/functions") === 0) {
    bad(rel + " uses readFileSync inside a Netlify function, which will silently fail");
  }
});

// Drift check: regenerate into memory and compare.
const md = fs.readFileSync(path.join(root, "skill/landal-copy-skill-dk.md"), "utf8");
const mod = require(path.join(root, "netlify/functions/skill-dk.js")).SKILL_DK;
if (md !== mod) bad("skill-dk.js has drifted from the markdown. Run: node scripts/sync-skill.js");

if (failed) { console.error("\nChecks failed.\n"); process.exit(1); }
console.log("All checks passed.");
