/**
 * Hermes safety shim for three's CommonJS build.
 *
 * `three/build/three.cjs` calls `process.emitWarning(...)` at module scope to
 * warn about deprecated CJS usage. React Native defines a partial `process`
 * global without `emitWarning`, so the call throws and the module never
 * evaluates — taking the whole route down with it. This module must be
 * imported before anything that pulls `three` on native.
 */
type ProcessWithWarnings = {
  emitWarning?: (...args: unknown[]) => void;
};

const runtimeProcess = (globalThis as { process?: ProcessWithWarnings }).process;

if (runtimeProcess && typeof runtimeProcess.emitWarning !== 'function') {
  runtimeProcess.emitWarning = () => {};
}
