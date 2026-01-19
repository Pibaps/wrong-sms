<script setup>
import { onBeforeUnmount } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()

// Cleanup on page unload
onBeforeUnmount(() => {
  if (gameStore.roomCode) {
    gameStore.leaveRoom()
  }
})
</script>

<template>
  <RouterView />
</template>

<style scoped></style>
