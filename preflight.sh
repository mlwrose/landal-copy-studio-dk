#!/usr/bin/env bash
# Run this in the repo root before pushing. It fails on exactly the things that
# have broken the DK Copy Studio deploy, so you find out here rather than on Netlify.
set -u
fail=0
ok(){ echo "  ok    $1"; }
bad(){ echo "  FAIL  $1"; fail=1; }

echo "structure"
for f in index.html netlify.toml package.json README.md \
         netlify/functions/generate.js netlify/functions/skill-dk.js \
         scripts/sync-skill.js scripts/check-rules.js \
         skill/landal-copy-skill-dk.md; do
  [ -f "$f" ] && ok "$f" || bad "$f is missing"
done

echo "stray files at root"
for f in generate.js sync-skill.js check-rules.js landal-copy-skill-dk.md; do
  [ -f "$f" ] && bad "$f is at root, it belongs in a subfolder" || ok "no stray $f"
done

echo "netlify config"
grep -q 'functions *= *"netlify/functions"' netlify.toml \
  && ok "functions directory set" || bad "functions directory not set in netlify.toml"
grep -q '^ *command *=' netlify.toml \
  && ok "build command pinned" \
  || bad "no build command; Netlify will auto-detect and run npm run build"

echo "syntax"
node --check netlify/functions/generate.js 2>/dev/null && ok "generate.js parses" || bad "generate.js has a syntax error"
node --check netlify/functions/skill-dk.js 2>/dev/null && ok "skill-dk.js parses" || bad "skill-dk.js has a syntax error"

echo "rules and drift"
node scripts/check-rules.js >/dev/null 2>&1 && ok "check-rules passes" || bad "check-rules failed, run it directly to see why"

echo
if [ "$fail" -eq 0 ]; then echo "Preflight passed. Safe to push."; else
  echo "Preflight failed. Fix the above before pushing."; fi
exit "$fail"
