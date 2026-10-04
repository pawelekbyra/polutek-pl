/**
 * Runs before first paint (inline <script> carrying the CSP nonce) so a remembered dark theme never
 * flashes light. Must use the same key as components/shell/theme.ts.
 */
export const THEME_STORAGE_KEY = "pp-admin-theme";
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
