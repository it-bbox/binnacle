<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { daemonSaid, type Said } from '~/i18n';

/**
 * What the daemon said, an attention item, an error or a reason, in the page's language from its
 * code and params; otherwise as the daemon wrote it, marked English. Its code is never shown.
 */
const props = defineProps<{ said: Said }>();
const { language } = useLanguage();
const shown = computed(() => daemonSaid(language.value, props.said));
</script>

<template>
  <span :lang="shown.english ? 'en' : undefined">{{ shown.text }}</span>
</template>
