/**
 * Host half of the permission-no-confirm bundle. The browser half in
 * `./client.js` owns every permission surface; this row exists so the Host
 * composes that client module into the boot graph while the shipped
 * `@deepseek-ai/dsh-client-ui-permission-presets` row stays disabled.
 */
export function apply() {}
