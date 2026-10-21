<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { daemonSaid, type Said } from '~/i18n';

/**
 * What the daemon said, an attention item, an error or a reason, in the page's language from its
 * code and params, or `translated`, the page's own wording of it; otherwise as the daemon wrote
 * it, marked English. Its code is never shown.
 */
const props = defineProps<{ said: Said; translated?: string }>();
const { language } = useLanguage();
const shown = computed(() =>
  props.translated === undefined ? daemonSaid(language.value, props.said) : { text: props.translated, english: props.translated === props.said.reason },
);
</script>

<template>
  <span :lang="shown.english ? 'en' : undefined">{{ shown.text }}</span>
</template>
