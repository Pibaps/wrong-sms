<template>
  <div class="min-h-dvh overflow-hidden flex flex-col items-stretch justify-start px-3 py-3 sm:px-4 sm:py-4">
    <div class="w-full max-w-2xl h-full mx-auto space-y-4 sm:space-y-6 flex min-h-0 flex-col">
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-2xl sm:text-3xl font-bold">Partie terminée</h1>
        <p class="text-gray-400">Récapitulatif des scores</p>
      </div>

      <!-- Winner Podium -->
      <div v-if="winner" class="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4 sm:p-6 text-center shrink-0">
        <div class="text-3xl sm:text-4xl mb-2">🏆</div>
        <p class="text-sm text-gray-400 mb-1">Vainqueur</p>
        <p class="text-xl sm:text-2xl font-bold text-yellow-400 break-words">{{ winner.name }}</p>
        <p class="text-2xl sm:text-3xl font-bold mt-2">{{ winner.score }} points</p>
      </div>

      <!-- Full Leaderboard -->
      <div class="bg-secondary rounded-2xl p-4 sm:p-6 space-y-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <h2 class="text-base sm:text-lg font-semibold shrink-0">Classement final</h2>
        <div class="space-y-2 sm:space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
          <div
            v-for="(player, index) in sortedPlayers"
            :key="player.id"
            class="flex items-center justify-between p-3 sm:p-4 rounded-2xl gap-3"
            :class="[
              index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' :
              index === 1 ? 'bg-gray-500/10 border border-gray-500/30' :
              index === 2 ? 'bg-orange-700/10 border border-orange-700/30' :
              'bg-primary'
            ]"
          >
            <div class="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <div class="text-xl sm:text-2xl font-bold w-7 sm:w-8 text-center shrink-0">
                {{ index + 1 }}
              </div>
              <div class="min-w-0">
                <p class="font-medium text-base sm:text-lg break-words">{{ player.name }}</p>
                <p class="text-sm text-gray-400">
                  {{ player.score }} point{{ player.score > 1 ? 's' : '' }}
                </p>
              </div>
            </div>
            <div v-if="index < 3" class="text-xl sm:text-2xl shrink-0">
              {{ index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="bg-secondary rounded-2xl p-4 sm:p-6 space-y-3 shrink-0">
        <h2 class="text-base sm:text-lg font-semibold mb-3">Statistiques</h2>
        <div class="grid grid-cols-2 gap-4 text-center">
          <div>
            <p class="text-xl sm:text-2xl font-bold">{{ gameStore.room?.round || 0 }}</p>
            <p class="text-sm text-gray-400">Manches jouées</p>
          </div>
          <div>
            <p class="text-xl sm:text-2xl font-bold">{{ playerCount }}</p>
            <p class="text-sm text-gray-400">Joueurs</p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3 pt-1 shrink-0">
        <button
          @click="newGame"
          class="btn btn-primary w-full"
        >
          Nouvelle partie
        </button>
        <button
          @click="backHome"
          class="btn btn-secondary w-full"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const router = useRouter()
const gameStore = useGameStore()

const sortedPlayers = computed(() => {
  if (!gameStore.room?.players) return []
  return Object.entries(gameStore.room.players)
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => b.score - a.score)
})

const winner = computed(() => sortedPlayers.value[0] || null)

const playerCount = computed(() => sortedPlayers.value.length)

function newGame() {
  gameStore.leaveRoom()
  router.push('/')
}

function backHome() {
  gameStore.leaveRoom()
  router.push('/')
}
</script>
