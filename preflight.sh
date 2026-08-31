#!/usr/bin/env bash
# Run in the repo root before pushing. Fails on exactly the things that have broken
# this deploy, so you find out here rather than on Netlify.
set -u
fail=0
ok(){ echo "  ok    $1"; }
bad(){ echo "  FAIL  $1"; fail=1; }

echo "the two files that must exist"
[ -f index.html ] && ok "index.html at root" || bad "index.html missing from root"
[ -f netlify/functions/generate.js ] \
  && ok "netlify/functions/generate.js" \
  || bad "netlify/functions/generate.js missing. Netlify will not create the function."

echo "stray files at root"
for f in generate.js sync-skill.js check-rules.js landal-copy-skill-dk.md skill-dk.js; do
  [ -f "$f" ] && bad "$f is at root, the folder structure was flattened" || ok "no stray $f"
done

echo "function is self contained"
if grep -qE 'require\("\./' netlify/functions/generate.js 2>/dev/null; then
  bad "generate.js requires a sibling file; it must be self contained"
else
  ok "no sibling requires"
fi
if grep -q 'PLACEHOLDER, run node' netlify/functions/generate.js 2>/dev/null; then
  bad "the skill block is still a placeholder. Run node scripts/sync-skill.js"
else
  ok "skill block filled in"
fi
chars=$(node -e "const s=require('fs').readFileSync('netlify/functions/generate.js','utf8');const m=s.match(/const SKILL_DK = \`([\s\S]*?)\`;/);process.stdout.write(String(m?m[1].length:0))" 2>/dev/null)
[ "${chars:-0}" -gt 5000 ] && ok "skill is $chars characters" || bad "skill block too short ($chars chars)"

echo "netlify config"
grep -q 'functions *= *"netlify/functions"' netlify.toml && ok "functions directory set" \
  || bad "functions directory not set in netlify.toml"
grep -qE '^ *command *=' netlify.toml && ok "build command pinned" \
  || bad "no build command; Netlify will auto-detect and run npm run build"

echo "syntax"
node --check netlify/functions/generate.js 2>/dev/null && ok "generate.js parses" \
  || bad "generate.js has a syntax error"

echo "rules and drift"
node scripts/check-rules.js >/dev/null 2>&1 && ok "check-rules passes" \
  || bad "check-rules failed, run it directly to see why"

echo
if [ "$fail" -eq 0 ]; then echo "Preflight passed. Safe to push."
else echo "Preflight failed. Fix the above before pushing."; fi
exit "$fail"
