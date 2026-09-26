<script setup lang="ts">
import UsageTable from '~/components/UsageTable.vue';
import { isUnavailable } from '~/composables/projects';
import type { ProjectUsage } from '~/composables/usage';

/** `usage.get`'s totals by role, and unassigned: the Usage page and the Project page show both. */
defineProps<{ usage: ProjectUsage }>();
</script>

<template>
  <p v-if="isUnavailable(usage.byRole)" class="muted">By role not available: {{ usage.byRole.reason }}</p>
  <UsageTable
    v-else
    :rows="[
      { key: 'product', label: 'Product', totals: usage.byRole.product },
      { key: 'implementation', label: 'Implementation', totals: usage.byRole.implementation },
      { key: 'unknown', label: 'Unknown role', totals: usage.byRole.unknown },
    ]"
  />
  <h3>Unassigned: runs no Task's branch accounts for</h3>
  <p v-if="isUnavailable(usage.unassigned)" class="muted">Not available: {{ usage.unassigned.reason }}</p>
  <UsageTable v-else :rows="[{ key: 'unassigned', label: 'Unassigned', totals: usage.unassigned }]" />
</template>

<style scoped>
h3 {
  font-size: 0.9rem;
  color: var(--muted);
}
</style>
