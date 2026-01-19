<template>
  <div class="min-h-screen flex flex-col p-4 pb-safe">
    <!-- Winner Reveal Overlay -->
    <div
      v-if="gameStore.winnerReveal"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-2xl p-8 max-w-md w-full text-center space-y-4 animate-pulse">
        <div class="text-5xl">🏆</div>
        <h2 class="text-2xl font-bold text-yellow-400">{{ gameStore.winnerReveal.playerName }} gagne !</h2>
        <div class="bg-white text-gray-900 rounded-xl p-6 shadow-lg">
          <p class="text-sm text-gray-500 mb-2">Réponse gagnante :</p>
          <p class="text-lg font-medium">{{ gameStore.winnerReveal.card }}</p>
        </div>
        <p class="text-sm text-gray-400">Prochaine manche dans un instant...</p>
      </div>
    </div>

    <div class="w-full max-w-4xl mx-auto space-y-4 py-4">
      <!-- Header with Player Info -->
      <div class="flex items-center justify-between bg-secondary rounded-lg p-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-sm">
            {{ gameStore.playerName.charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="font-medium text-sm">{{ gameStore.playerName }}</p>
            <p class="text-xs text-gray-500">Manche {{ gameStore.room?.round }}</p>
          </div>
        </div>
        <button
          v-if="gameStore.isHost"
          @click="endGame"
          class="text-sm text-red-400 hover:text-red-300"
        >
          Terminer
        </button>
      </div>

      <!-- Current SMS Card -->
      <div class="bg-gray-900 rounded-2xl p-6 shadow-lg">
        <div class="flex flex-col space-y-2">
          <div class="flex items-center space-x-2 mb-2">
            <div class="w-2 h-2 bg-green-400 rounded-full"></div>
            <p class="text-xs text-gray-500">SMS reçu</p>
          </div>
          <div class="card-sms card-sms-received">
            <p class="text-base leading-relaxed">{{ gameStore.room?.currentSms }}</p>
          </div>
        </div>
      </div>

      <!-- Judge View -->
      <div v-if="gameStore.isJudge">
        <div class="bg-accent/10 border border-accent rounded-lg p-4 mb-4">
          <p class="text-accent font-medium">Vous êtes le juge</p>
          <p class="text-sm text-gray-400 mt-1">
            {{ allPlayed ? 'Tous les joueurs ont répondu' : 'En attente des réponses...' }}
          </p>
        </div>

        <!-- Reveal Button -->
        <div v-if="allPlayed && !gameStore.room?.playedCards?.length" class="mb-4">
          <button
            @click="revealCards"
            class="btn btn-primary w-full"
          >
            Révéler les réponses
          </button>
        </div>

        <!-- Played Cards (Judge Selection) -->
        <div v-if="gameStore.room?.playedCards?.length" class="space-y-3">
          <p class="text-sm text-gray-400 mb-3">Réponses proposées :</p>
          <div class="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div
              v-for="(card, index) in gameStore.room.playedCards"
              :key="index"
              @click="selectWinner(index)"
              class="cursor-pointer transition-all hover:scale-102"
            >
              <div class="card-sms card-sms-sent">
                <p class="text-base">{{ card.text }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Waiting for players -->
        <div v-else-if="!allPlayed" class="space-y-2">
          <div
            v-for="player in nonJudgePlayers"
            :key="player.id"
            class="bg-secondary rounded-lg p-4 flex items-center justify-between"
          >
            <span>{{ player.name }}</span>
            <span v-if="player.playedCard" class="text-green-400">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </span>
            <span v-else class="text-gray-500 text-sm">En attente...</span>
          </div>
        </div>
      </div>

      <!-- Player View -->
      <div v-else>
        <!-- Already Played -->
        <div v-if="gameStore.currentPlayer?.playedCard" class="bg-green-500/10 border border-green-500 rounded-lg p-4 mb-4">
          <p class="text-green-400 font-medium">Réponse envoyée</p>
          <p class="text-sm text-gray-400 mt-1">En attente du choix du juge...</p>
          <div class="mt-3 bg-gray-900 rounded-2xl p-4">
            <div class="card-sms card-sms-sent">
              <p class="text-sm">{{ gameStore.currentPlayer.playedCard }}</p>
            </div>
          </div>
        </div>

        <!-- Player Hand -->
        <div v-else class="space-y-3">
          <p class="text-sm text-gray-400">Votre main :</p>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="(card, index) in gameStore.currentPlayer?.hand"
              :key="index"
              @click="playCard(index)"
              class="card-hand card-hand-hover"
            >
              <div class="absolute top-2 left-2 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                {{ index + 1 }}
              </div>
              <div class="flex-1 flex items-center justify-center p-4">
                <p class="text-sm leading-snug">{{ card }}</p>
              </div>
              <div class="absolute bottom-0 left-0 right-0 h-1 bg-accent"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scoreboard -->
      <div class="bg-secondary rounded-lg p-4 mt-6">
        <h3 class="text-sm font-semibold mb-3 text-gray-400">Scores</h3>
        <div class="space-y-2">
          <div
            v-for="player in sortedPlayers"
            :key="player.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-2">
              <div
                v-if="player.id === gameStore.room?.currentJudge"
                class="w-2 h-2 bg-accent rounded-full"
                title="Juge actuel"
              ></div>
              <span :class="[player.id === gameStore.playerId && 'font-bold text-white']">
                {{ player.name }}
              </span>
            </div>
            <span class="font-medium">{{ player.score }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const router = useRouter()
const gameStore = useGameStore()

const playerCount = computed(() => {
  return gameStore.room?.players ? Object.keys(gameStore.room.players).length : 0
})

const sortedPlayers = computed(() => {
  if (!gameStore.room?.players) return []
  return Object.entries(gameStore.room.players)
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => b.score - a.score)
})

const nonJudgePlayers = computed(() => {
  return sortedPlayers.value.filter(p => p.id !== gameStore.room?.currentJudge)
})

const allPlayed = computed(() => gameStore.allPlayersPlayed)

// Watch for game end
watch(() => gameStore.gameState, (newState) => {
  if (newState === 'results') {
    router.push('/results')
  }
})

async function playCard(index) {
  if (gameStore.isJudge || gameStore.currentPlayer?.playedCard) return
  await gameStore.playCard(index)
}

async function revealCards() {
  await gameStore.revealCards()
}

async function selectWinner(index) {
  if (!gameStore.isJudge) return
  await gameStore.selectWinner(index)
}

function endGame() {
  if (confirm('Terminer la partie et afficher les résultats ?')) {
    gameStore.endGame()
  }
}
</script>
