#!/usr/bin/env bash
# Run every known-answer suite: src/lib/<folder>/self-check.ts, one per folder.
#
# The suites are plain TypeScript returning `{ name, pass, detail }[]`, so they
# need no test runner — just an emit and a `node -e`. These are the exact flags
# from docs/03-architecture.md: `--target es2022` because the app's own lib level
# uses `Array.prototype.at`, and `--ignoreDeprecations 6.0` because TypeScript 6
# still accepts `--moduleResolution node10` only if you say you know.
#
# Run it directly (`bash tools/checks/self-check.sh`) or through `npm run check`,
# which is what CI runs. Exits 1 if any suite fails to compile, fails to run, or
# reports a failing check.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

SUITES=(bench notes sentinel)
TSC=./node_modules/.bin/tsc
[ -x "$TSC" ] || TSC=npx\ tsc

total=0
failing=0
broken=0

for lib in "${SUITES[@]}"; do
  src="src/lib/$lib/self-check.ts"
  if [ ! -f "$src" ]; then
    printf 'skip  %-9s no %s\n' "$lib" "$src"
    continue
  fi

  out=$(mktemp -d)

  if ! eval "$TSC" "$src" --ignoreConfig --outDir "$out" \
        --module commonjs --target es2022 --moduleResolution node10 \
        --ignoreDeprecations 6.0 --skipLibCheck >"$out/tsc.log" 2>&1; then
    printf 'FAIL  %-9s does not compile\n' "$lib"
    sed 's/^/        /' "$out/tsc.log" | head -20
    broken=$((broken + 1))
    rm -rf "$out"
    continue
  fi

  js=$(find "$out" -name 'self-check.js' -print -quit)
  report=$(node -e '
    const r = require(process.argv[1]).runSelfCheck();
    const bad = r.filter((c) => !c.pass);
    for (const c of bad) console.log("        · " + c.name + (c.detail ? " — " + c.detail : ""));
    console.log("SUMMARY " + r.length + " " + bad.length);
  ' "$js" 2>&1)
  if [ $? -ne 0 ]; then
    printf 'FAIL  %-9s did not run\n' "$lib"
    printf '%s\n' "$report" | sed 's/^/        /' | head -20
    broken=$((broken + 1))
    rm -rf "$out"
    continue
  fi

  summary=$(printf '%s\n' "$report" | tail -1)
  n=${summary#SUMMARY }; bad=${n#* }; n=${n%% *}
  printf '%s\n' "$report" | sed '$d'

  total=$((total + n))
  failing=$((failing + bad))

  if [ "$bad" -eq 0 ]; then
    printf 'ok    %-9s %s checks\n' "$lib" "$n"
  else
    printf 'FAIL  %-9s %s of %s checks failed\n' "$lib" "$bad" "$n"
  fi

  rm -rf "$out"
done

printf '\n%s checks · %s failing\n' "$total" "$failing"
if [ "$failing" -ne 0 ] || [ "$broken" -ne 0 ]; then
  [ "$broken" -eq 0 ] || printf '%s suite(s) could not run\n' "$broken"
  exit 1
fi
