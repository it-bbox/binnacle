// No bundled font: the dashboard's system stack is the site's, and nothing is fetched (ADR-0033).
import DefaultTheme from 'vitepress/theme-without-fonts'
import { h } from 'vue'
import LanguageSwitch from './LanguageSwitch.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(LanguageSwitch),
      'nav-screen-content-after': () => h(LanguageSwitch),
    })
  },
}
