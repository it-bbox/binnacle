// A client-side application generated to static files, which the daemon serves at its own
// address (ADR-0031). Nothing of Nuxt runs in the daemon, and the page reaches nothing else:
// Nuxt UI's fonts are the system's and its icons are bundled at build time (ADR-0033).
export default defineNuxtConfig({
  compatibilityDate: '2026-09-26',
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ui: {
    fonts: false,
    theme: { colors: ['primary', 'success', 'warning', 'error'] },
  },
  // The theme follows the system; there is no switch. Switching without the transition-suppressing
  // <style> Nuxt UI turns on, which the daemon's Content-Security-Policy refuses.
  colorMode: { preference: 'system', fallback: 'light', disableTransition: false },
  icon: {
    // Only the locally installed Lucide collection, bundled into the client; never the Iconify API.
    provider: 'none',
    fallbackToApi: false,
    // Inline SVG: the CSS mode writes <style> elements the daemon's Content-Security-Policy refuses.
    mode: 'svg',
    clientBundle: { scan: true },
  },
  hooks: {
    // Nuxt UI's colours plugin writes an inline <style>, which the CSP refuses; main.css declares them.
    // A Nuxt UI that moves the plugin fails the build here rather than bring the <style> back.
    'app:resolve'(app) {
      const kept = app.plugins.filter((plugin) => !/[\\/]@nuxt[\\/]ui[\\/].*[\\/]plugins[\\/]colors/.test(plugin.src));
      if (kept.length === app.plugins.length) throw new Error("Nuxt UI's colours plugin was not found to remove; its inline <style> would break the daemon's CSP.");
      app.plugins = kept;
    },
  },
  app: {
    head: {
      title: 'Binnacle',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});
