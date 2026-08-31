#!/usr/bin/env bash
# Run in the repo root before pushing. Fails on exactly the things that have broken
# this deploy, so you find out here rather than on Netlify.
set -u
fail=0
ok(){ echo "  ok    $1"; }
bad(){ echo "  FAIL  $1"; fail=1; }

echo "the two files that must exist"
[ -f public/index.html ] && ok "public/index.html" \
  || bad "public/index.html missing. The site will serve a 404 at /"
[ -f netlify/functions/generate.js ] && ok "netlify/functions/generate.js" \
  || bad "netlify/functions/generate.js missing. Netlify will not create the function."

echo "nothing flattened to the root"
for f in index.html generate.js sync-skill.js check-rules.js landal-copy-skill-dk.md skill-dk.js; do
  [ -f "$f" ] && bad "$f is at root, the folder structure was flattened" || ok "no stray $f"
done

echo "publish and functions must not overlap"
# Read real settings only. Comment lines mention these keys too, so drop them first.
toml_get(){
  grep -v '^[[:space:]]*#' netlify.toml \
    | grep -E "^[[:space:]]*$1[[:space:]]*=" \
    | head -1 \
    | sed -E 's/.*=[[:space:]]*"([^"]*)".*/\1/'
}
pub=$(toml_get publish)
fns=$(toml_get functions)
[ -n "$pub" ] && ok "publish is '$pub'" || bad "publish not set in netlify.toml"
[ -n "$fns" ] && ok "functions is '$fns'" || bad "functions not set in netlify.toml"
if [ "$pub" = "." ] || case "$fns" in "$pub"/*) true;; *) false;; esac; then
  bad "functions dir is inside the publish dir. Netlify will not deploy the function."
else
  ok "functions dir is outside the publish dir"
fi
grep -qE '^ *command *=' netlify.toml && ok "build command pinned" \
  || bad "no build command; Netlify will auto-detect and run npm run build"

echo "the skill must not be publicly served"
[ -f public/landal-copy-skill-dk.md ] && bad "the skill is inside public/ and would be downloadable" \
  || ok "skill is not in the publish dir"

echo "function is self contained"
grep -qE 'require\("\./' netlify/functions/generate.js 2>/dev/null \
  && bad "generate.js requires a sibling file; it must be self contained" \
  || ok "no sibling requires"
grep -q 'PLACEHOLDER, run node' netlify/functions/generate.js 2>/dev/null \
  && bad "the skill block is still a placeholder. Run node scripts/sync-skill.js" \
  || ok "skill block filled in"
chars=$(node -e "const s=require('fs').readFileSync('netlify/functions/generate.js','utf8');const m=s.match(/const SKILL_DK = \`([\s\S]*?)\`;/);process.stdout.write(String(m?m[1].length:0))" 2>/dev/null)
[ "${chars:-0}" -gt 5000 ] && ok "skill is $chars characters" || bad "skill block too short ($chars chars)"

echo "syntax"
node --check netlify/functions/generate.js 2>/dev/null && ok "generate.js parses" \
  || bad "generate.js has a syntax error"

echo "rules and drift"
node scripts/check-rules.js >/dev/null 2>&1 && ok "check-rules passes" \
  || bad "check-rules failed, run it directly to see why"

echo "stale references"
if grep -q 'skill-dk.js' public/index.html netlify/functions/generate.js 2>/dev/null; then
  bad "something still references skill-dk.js, which no longer exists"
else
  ok "no references to deleted files"
fi

echo
if [ "$fail" -eq 0 ]; then echo "Preflight passed. Safe to push."
else echo "Preflight failed. Fix the above before pushing."; fi
exit "$fail"
