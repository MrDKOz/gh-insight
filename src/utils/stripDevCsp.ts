/**
 * Strips development-only CSP directives from the production HTML so the
 * deployed bundle doesn't ship with 'unsafe-eval' (Vite HMR only) or the
 * local WebSocket connect-src (Vite dev server only).
 *
 * Also adds data-cfasync="false" to every <script type="module"> tag so that
 * Cloudflare Rocket Loader leaves them alone. Without this attribute, Rocket
 * Loader rewrites the type to a non-standard value and depends on an injected
 * inline script to re-execute the deferred scripts. That inline script is
 * blocked by our script-src 'self' CSP, which breaks the app entirely.
 */
export const stripDevCsp = (html: string): string => html
    .replace(/'unsafe-eval'\s*/g, "")
    // Remove 'unsafe-inline' from script-src only — style-src keeps it for Emotion
    .replace(/(script-src\s[^;]*?)'unsafe-inline'\s*/g, "$1")
    .replace(/\s*ws:\/\/localhost:[^;]*;?/g, ";")
    .replace(/(<script\s[^>]*type="module"[^>]*)>/g, '$1 data-cfasync="false">');
