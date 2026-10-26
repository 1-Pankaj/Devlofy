#!/usr/bin/env bash
# Run every known-answer suite: src/lib/<folder>/self-check.ts, one per folder.
#
# The suites are plain TypeScript returning `{ name, pass, detail }[]`, so they
# need no test runner — just an emit and a `node -e`. Each suite is compiled
# through a generated tsconfig that repeats the project's path aliases (`@/…`),
# because a suite may import a module that names a type by alias and the app's
# own tsconfig cannot be reused directly: `expo/tsconfig.base` sets
# `customConditions`, which TypeScript refuses alongside commonjs output.
#
# Run it directly (`bash tools/checks/self-check.sh`) or through `npm run check`.
# Exits 1 if any suite fails to compile, fails to run, or reports a failure.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1
ROOT=$(pwd)

# Windows runs a Windows `tsc` and a Windows `node`; neither can read an MSYS
# shell path (`/d/…`, `/tmp/…`). Anything handed to them goes through
# `cfg_path`, which asks cygpath for the mixed form (`D:/…`) — valid inside the
# generated tsconfig JSON and for both binaries. Elsewhere it is a no-op.
cfg_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

SUITES=(bench engine notes sentinel)
TSC=./node_modules/.bin/tsc
# -f, not -x: npm's Windows install does not always carry an executable bit.
[ -f "$TSC" ] || TSC=npx\ tsc

total=0
failing=0
broken=0

for lib in "${SUITES[@]}"; do
  src="$ROOT/src/lib/$lib/self-check.ts"
  if [ ! -f "$src" ]; then
    printf 'skip  %-9s no %s\n' "$lib" "src/lib/$lib/self-check.ts"
    continue
  fi

  out=$(mktemp -d)

  cat >"$out/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "baseUrl": "$(cfg_path "$ROOT")",
    "paths": { "@/*": ["src/*"], "@/assets/*": ["assets/*"] },
    "noEmit": false,
    "rootDir": "$(cfg_path "$ROOT")",
    "outDir": "$(cfg_path "$out/js")",
    "module": "commonjs",
    "moduleResolution": "node10",
    "target": "es2022",
    "jsx": "react-jsx",
    "ignoreDeprecations": "6.0",
    "skipLibCheck": true,
    "types": []
  },
  "include": ["$(cfg_path "$src")"]
}
JSON

  if ! eval "$TSC" -p "$out/tsconfig.json" >"$out/tsc.log" 2>&1; then
    printf 'FAIL  %-9s does not compile\n' "$lib"
    sed 's/^/        /' "$out/tsc.log" | head -20
    broken=$((broken + 1))
    rm -rf "$out"
    continue
  fi

  js=$(find "$out/js" -name 'self-check.js' -print -quit)
  report=$(node -e '
    const r = require(process.argv[1]).runSelfCheck();
    const bad = r.filter((c) => !c.pass);
    for (const c of bad) console.log("        · " + c.name + (c.detail ? " — " + c.detail : ""));
    console.log("SUMMARY " + r.length + " " + bad.length);
  ' "$(cfg_path "$js")" 2>&1)
  if [ $? -ne 0 ]; then
    printf 'FAIL  %-9s did not run\n' "$lib"
    printf '%s\n' "$report" | sed 's/^/        /' | head -20
    broken=$((broken + 1))
    rm -rf "$out"
    continue
  fi

  summary=$(printf '%s\n' "$report" | tail -1)
  counts=${summary#SUMMARY }
  bad=${counts#* }
  n=${counts%% *}
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
