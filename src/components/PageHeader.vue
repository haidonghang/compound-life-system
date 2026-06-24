<script setup>
defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
});
</script>

<template>
  <header class="page-header">
    <div>
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>
