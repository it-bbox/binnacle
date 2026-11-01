// No bundled font: the dashboard's system stack is the site's, and nothing is fetched (ADR-0033).
import DefaultTheme from 'vitepress/theme-without-fonts'
import { h } from 'vue'
import type { Theme } from 'vitepress'
import LanguageSwitch from './LanguageSwitch.vue'
import LandingHero from './LandingHero.vue'
import LandingTour from './LandingTour.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LandingHero', LandingHero)
    app.component('LandingTour', LandingTour)
  },
  Layout() {
    // In the bar at every width, beside the menu button on a phone: the open menu adds none.
    return h(DefaultTheme.Layout, null, { 'nav-bar-content-after': () => h(LanguageSwitch) })
  },
} satisfies Theme
