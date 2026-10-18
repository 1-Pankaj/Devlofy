/**
 * Web-only document tweaks. Native is a no-op (Metro resolves `web-reset.web.ts`
 * on web and this file everywhere else).
 *
 * Why this exists at all: React Native Web's reset leaves the browser's default
 * focus ring (`outline: auto 1px`) on inputs, which reads as a black rectangle
 * around a field that already draws its own focus state. The app owns that ring.
 */
export function applyWebReset(): void {}
