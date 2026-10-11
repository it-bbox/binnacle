<script setup lang="ts">
import { useLanguage } from '~/composables/language';

/** A text folded to six of its lines, with a control to unfold it in place when it is longer; attributes go to the text. */
defineOptions({ inheritAttrs: false });
const { t } = useLanguage();
const open = ref(false);
const long = ref(false);
const body = ref<HTMLElement | null>(null);

const measure = (): void => {
  if (body.value !== null && !open.value) long.value = body.value.scrollHeight > body.value.clientHeight + 1;
};
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (body.value === null) return;
  observer = new ResizeObserver(measure);
  observer.observe(body.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="flex min-w-0 flex-col items-start">
    <div ref="body" v-bind="$attrs" class="w-full" :class="open ? '' : 'max-h-[6lh] overflow-hidden'"><slot /></div>
    <UButton
      v-if="long"
      :label="open ? t.showLess : t.readMore"
      :aria-expanded="open"
      color="neutral"
      variant="link"
      size="xs"
      class="px-0"
      @click="open = !open"
    />
  </div>
</template>
