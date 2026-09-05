<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
    <p class="text-4xl font-semibold text-zinc-300 dark:text-zinc-700">404</p>
    <p class="text-sm text-zinc-500 dark:text-zinc-400">{{ $t('That page does not exist in this console.') }}</p>
    <RouterLink class="btn btn-primary mt-2" :to="{ name: 'dashboard' }">{{ $t('Back to dashboard') }}</RouterLink>
  </div>
</template>
