<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const router = useRouter()

function handleBeforeUnload() {
  if (gameStore.roomCode) {
    void gameStore.leaveRoom()
  }
}

// On app load, try to rejoin existing room if reloading mid-game
onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)

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
  window.removeEventListener('beforeunload', handleBeforeUnload)

  if (gameStore.roomCode) {
    void gameStore.leaveRoom()
  }
})
</script>

<template>
  <RouterView />
</template>

<style scoped></style>
