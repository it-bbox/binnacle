// A client-side application generated to static files, which the daemon serves at its own
// address (ADR-0031). Nothing of Nuxt runs in the daemon, and the page reaches nothing else.
export default defineNuxtConfig({
  compatibilityDate: '2026-09-26',
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Binnacle',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});
