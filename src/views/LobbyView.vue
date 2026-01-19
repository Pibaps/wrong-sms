<template>
  <div class="min-h-screen flex flex-col p-4">
    <div class="w-full max-w-2xl mx-auto space-y-6 py-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button @click="leave" class="text-gray-400 hover:text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold">Lobby</h1>
        <div class="w-6"></div>
      </div>

      <!-- Room Code -->
      <div class="bg-secondary rounded-lg p-6 text-center space-y-2">
        <p class="text-sm text-gray-400">Code de la partie</p>
        <p class="text-3xl font-bold tracking-widest">{{ gameStore.roomCode }}</p>
        <p class="text-xs text-gray-500">Partagez ce code avec vos amis</p>
      </div>

      <!-- Players List -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Joueurs ({{ playerCount }}/10)</h2>
          <span :class="[
            'text-sm px-3 py-1 rounded-full',
            canStart ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
          ]">
            {{ canStart ? 'Prêt' : `Min. 3 joueurs` }}
          </span>
        </div>

        <div class="space-y-2">
          <div
            v-for="player in players"
            :key="player.id"
            class="bg-secondary rounded-lg p-4 flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold">
                {{ player.name.charAt(0).toUpperCase() }}
              </div>
              <div>
                <p class="font-medium">{{ player.name }}</p>
                <p v-if="player.id === gameStore.room?.host" class="text-xs text-gray-400">Hôte</p>
              </div>
            </div>
            <div v-if="player.ready" class="text-green-400">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Import Deck (Host Only) -->
      <div v-if="gameStore.isHost" class="space-y-3">
        <div class="border-t border-gray-700 pt-6">
          <h2 class="text-lg font-semibold mb-3">Deck personnalisé (optionnel)</h2>
          <div class="bg-secondary rounded-lg p-4 space-y-3">
            <p class="text-sm text-gray-400">
              Importez vos propres cartes au format JSON ou CSV
            </p>
            
            <label class="btn btn-secondary w-full cursor-pointer text-center">
              <input
                type="file"
                accept=".json,.csv"
                class="hidden"
                @change="handleFileUpload"
              />
              Choisir un fichier
            </label>

            <div v-if="importStatus" :class="[
              'text-sm p-2 rounded',
              importStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            ]">
              {{ importStatus.message }}
            </div>

            <details class="text-sm text-gray-400">
              <summary class="cursor-pointer hover:text-white">Format attendu</summary>
              <pre class="mt-2 bg-primary p-2 rounded text-xs overflow-x-auto">
{
  "sms": [
    "Carte SMS 1...",
    "Carte SMS 2..."
  ],
  "reponses": [
    "Réponse 1...",
    "Réponse 2..."
  ]
}</pre>
            </details>
          </div>
        </div>
      </div>

      <!-- Start Button (Host Only) -->
      <button
        v-if="gameStore.isHost"
        @click="startGame"
        :disabled="!canStart"
        class="btn btn-primary w-full py-4 text-lg"
      >
        Lancer la partie
      </button>

      <!-- Waiting Message (Non-Host) -->
      <div v-else class="text-center text-gray-400 py-4">
        <p>En attente que l'hôte lance la partie...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import Papa from 'papaparse'

const router = useRouter()
const gameStore = useGameStore()

const importStatus = ref(null)

const players = computed(() => {
  if (!gameStore.room?.players) return []
  return Object.entries(gameStore.room.players).map(([id, player]) => ({
    id,
    ...player
  }))
})

const playerCount = computed(() => players.value.length)
const canStart = computed(() => playerCount.value >= 3)

// Watch for game state change
watch(() => gameStore.gameState, (newState) => {
  if (newState === 'playing') {
    router.push('/game')
  }
})

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  importStatus.value = null

  if (file.name.endsWith('.json')) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.sms || !data.reponses) {
          throw new Error('Format invalide: "sms" et "reponses" requis')
        }
        await gameStore.updateDeck(data)
        importStatus.value = {
          type: 'success',
          message: `${data.sms.length} SMS et ${data.reponses.length} réponses importés`
        }
      } catch (err) {
        importStatus.value = {
          type: 'error',
          message: 'Erreur: ' + err.message
        }
      }
    }
    reader.readAsText(file)
  } else if (file.name.endsWith('.csv')) {
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const data = { sms: [], reponses: [] }
          results.data.forEach(row => {
            if (row.sms && row.sms.trim()) data.sms.push(row.sms.trim())
            if (row.reponse && row.reponse.trim()) data.reponses.push(row.reponse.trim())
          })
          
          if (data.sms.length === 0 && data.reponses.length === 0) {
            throw new Error('Aucune donnée trouvée dans le CSV')
          }
          
          await gameStore.updateDeck(data)
          importStatus.value = {
            type: 'success',
            message: `${data.sms.length} SMS et ${data.reponses.length} réponses importés`
          }
        } catch (err) {
          importStatus.value = {
            type: 'error',
            message: 'Erreur: ' + err.message
          }
        }
      },
      error: (err) => {
        importStatus.value = {
          type: 'error',
          message: 'Erreur lors de la lecture du CSV'
        }
      }
    })
  }

  // Reset input
  event.target.value = ''
}

async function startGame() {
  if (!canStart.value) return
  await gameStore.startGame()
}

function leave() {
  if (confirm('Êtes-vous sûr de vouloir quitter ?')) {
    gameStore.leaveRoom()
    router.push('/')
  }
}
</script>
