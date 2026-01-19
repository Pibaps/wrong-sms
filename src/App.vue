<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const router = useRouter()

// On app load, try to rejoin existing room if reloading mid-game
onMounted(async () => {
  if (gameStore.playerName) {
    const rejoined = await gameStore.rejoinRoom()
    if (rejoined && router.currentRoute.value.path === '/') {
      // Only redirect from home page
      if (gameStore.gameState === 'playing') {
        router.push('/game')
      } else if (gameStore.gameState === 'results') {
        router.push('/results')
      } else if (gameStore.gameState === 'lobby') {
        router.push('/lobby')
      }
    }
  }
})

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
