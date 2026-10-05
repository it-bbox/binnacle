<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { daemonReason } from '~/i18n';

/**
 * A reason the daemon wrote, in the page's language when the page knows it, or `translated`, the
 * page's own wording of it; otherwise as the daemon wrote it, marked English.
 */
const props = defineProps<{ reason: string; translated?: string }>();
const { language } = useLanguage();
const shown = computed(() => props.translated ?? daemonReason(language.value, props.reason));
</script>

<template>
  <span :lang="shown === reason ? 'en' : undefined">{{ shown }}</span>
</template>
