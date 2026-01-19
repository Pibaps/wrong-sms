<template>
  <div class="min-h-screen flex flex-col p-4 pb-safe">
    <!-- Winner Reveal Overlay -->
    <div
      v-if="gameStore.room?.winnerReveal"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-2xl p-8 max-w-md w-full text-center space-y-4 animate-pulse">
        <div class="text-5xl">🏆</div>
        <h2 class="text-2xl font-bold text-yellow-400">{{ gameStore.room.winnerReveal.playerName }} gagne !</h2>
        <div class="bg-gray-900 rounded-2xl p-4">
          <div class="card-sms card-sms-sent mx-auto">
            <p class="text-base font-medium">{{ gameStore.room.winnerReveal.card }}</p>
          </div>
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
            <p class="text-xs text-gray-500">Manche {{ gameStore.room?.round }} • {{ playerCount }} joueurs</p>
          </div>
        </div>
        <button
          @click="leave"
          class="text-sm text-red-400 hover:text-red-300"
        >
          Quitter
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
            :disabled="!allPlayed"
            class="btn btn-primary w-full"
          >
            Révéler les réponses
          </button>
        </div>

        <!-- Played Cards (Judge Selection) with SMS conversation style -->
        <div v-if="gameStore.room?.playedCards?.length" class="space-y-3">
          <p class="text-sm text-gray-400 mb-3">Cliquez sur la meilleure réponse :</p>
          <div class="bg-gray-900 rounded-2xl p-4 space-y-4">
            <!-- Original SMS -->
            <div class="flex flex-col">
              <div class="card-sms card-sms-received">
                <p class="text-base">{{ gameStore.room?.currentSms }}</p>
              </div>
            </div>
            
            <!-- All responses with different colors -->
            <div class="space-y-3 pl-4">
              <div
                v-for="(card, index) in gameStore.room.playedCards"
                :key="index"
                @click="selectWinner(index)"
                class="cursor-pointer transition-all hover:scale-105"
              >
                <div 
                  class="card-sms card-sms-sent"
                  :style="{ backgroundColor: getResponseColor(index) }"
                >
                  <p class="text-base">{{ card.text }}</p>
                </div>
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
        <!-- Already Played - Show as conversation only -->
        <div v-if="gameStore.currentPlayer?.playedCard" class="space-y-3">
          <div class="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div class="card-sms card-sms-received">
              <p class="text-base">{{ gameStore.room?.currentSms }}</p>
            </div>
            <div class="pl-4">
              <div class="card-sms card-sms-sent">
                <p class="text-base">{{ gameStore.currentPlayer.playedCard }}</p>
              </div>
            </div>
          </div>
          <p class="text-center text-sm text-gray-500">En attente du juge...</p>
        </div>

        <!-- Player Hand as SMS bubbles -->
        <div v-else class="space-y-3">
          <p class="text-sm text-gray-400 mb-2">Choisissez votre réponse :</p>
          <div class="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div
              v-for="(card, index) in gameStore.currentPlayer?.hand"
              :key="index"
              @click="playCard(index)"
              class="cursor-pointer transition-all hover:scale-102"
            >
              <div class="card-sms card-sms-sent">
                <p class="text-sm leading-snug">{{ card }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scoreboard -->
      <div class="bg-secondary rounded-lg p-4 mt-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-400">Scores</h3>
          <div class="text-xs text-gray-500">
            Code: <span class="font-mono font-bold text-accent">{{ gameStore.roomCode }}</span>
          </div>
        </div>
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

// Colors for different responses
const responseColors = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

function getResponseColor(index) {
  return responseColors[index % responseColors.length]
}

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

function leave() {
  if (confirm('Voulez-vous vraiment quitter la partie ?')) {
    gameStore.leaveRoom()
    router.push('/')
  }
}
</script>
