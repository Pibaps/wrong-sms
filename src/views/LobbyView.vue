<template>
  <div class="min-h-dvh overflow-hidden flex flex-col px-3 py-3 sm:px-4 sm:py-4 pb-safe">
    <div class="w-full max-w-2xl mx-auto flex min-h-0 flex-1 flex-col gap-4 sm:gap-5 py-0 sm:py-1">
      <!-- Header -->
      <div class="flex items-center justify-between shrink-0">
        <button @click="leave" class="text-gray-400 hover:text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-xl sm:text-2xl font-bold">Lobby</h1>
        <div class="w-6"></div>
      </div>

      <!-- Room Code -->
      <div class="bg-secondary rounded-2xl p-4 sm:p-5 text-center space-y-2 shrink-0">
        <p class="text-sm text-gray-400">Code de la partie</p>
        <p class="text-2xl sm:text-3xl font-bold tracking-[0.2em] sm:tracking-widest break-all">{{ gameStore.roomCode }}</p>
        <p class="text-xs text-gray-500">Partagez ce code avec vos amis</p>
      </div>

      <!-- Players List -->
      <div class="space-y-3 flex min-h-0 flex-1 flex-col">
        <div class="flex items-center justify-between shrink-0">
          <h2 class="text-base sm:text-lg font-semibold">Joueurs ({{ playerCount }}/10)</h2>
          <span :class="[
            'text-sm px-3 py-1 rounded-full',
            canStart ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
          ]">
            {{ canStart ? 'Prêt' : `Min. 3 joueurs` }}
          </span>
        </div>

        <div class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          <div
            v-for="player in players"
            :key="player.id"
            class="bg-secondary rounded-2xl p-3 sm:p-4 flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent flex items-center justify-center font-bold shrink-0">
                {{ player.name.charAt(0).toUpperCase() }}
              </div>
              <div>
                <p class="font-medium leading-tight break-words">{{ player.name }}</p>
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
      <div v-if="gameStore.isHost" class="space-y-3 shrink-0">
        <div class="border-t border-gray-700 pt-6">
          <h2 class="text-base sm:text-lg font-semibold mb-3">Deck personnalisé (optionnel)</h2>
          <div class="bg-secondary rounded-2xl p-4 sm:p-5 space-y-3">
            <p class="text-sm text-gray-400">
              Importez vos propres cartes au format JSON ou CSV, ou ajoutez des réponses maison à la main
            </p>

            <div class="space-y-2 rounded-2xl bg-primary/60 p-3 sm:p-4 border border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-medium">Réponses maison</p>
                  <p class="text-xs text-gray-400">Une réponse par ligne ou séparée par des virgules</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent whitespace-nowrap">
                  {{ manualResponseCount }} réponse{{ manualResponseCount > 1 ? 's' : '' }} perso
                </span>
              </div>

              <textarea
                v-model="manualResponsesInput"
                rows="4"
                class="input-field resize-none"
                placeholder="Exemple :\nmon coloc complètement perdu\nune réunion Teams catastrophique\nun message envoyé au mauvais groupe"
              ></textarea>

              <button
                @click="addManualResponses"
                :disabled="!manualResponsesInput.trim()"
                class="btn btn-secondary w-full"
              >
                Ajouter ces réponses au deck
              </button>
            </div>
            
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
        class="btn btn-primary w-full py-3 sm:py-4 text-base sm:text-lg shrink-0"
      >
        Lancer la partie
      </button>

      <!-- Waiting Message (Non-Host) -->
      <div v-else class="text-center text-gray-400 py-3 shrink-0">
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
const manualResponsesInput = ref('')
const customDeck = ref({
  sms: [],
  reponses: [],
})

const players = computed(() => {
  if (!gameStore.room?.players) return []
  return Object.entries(gameStore.room.players).map(([id, player]) => ({
    id,
    ...player
  }))
})

const playerCount = computed(() => players.value.length)
const canStart = computed(() => playerCount.value >= 3)
const manualResponseCount = computed(() => customDeck.value.reponses.length)

function uniqueItems(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function parseCustomResponses(value) {
  return uniqueItems(
    value
      .replace(/\r/g, '')
      .split(/[\n,;]+/)
      .map(item => item.trim())
  )
}

async function syncCustomDeck(message) {
  try {
    await gameStore.updateDeck(customDeck.value)
    importStatus.value = {
      type: 'success',
      message,
    }
  } catch (err) {
    importStatus.value = {
      type: 'error',
      message: 'Erreur: ' + err.message,
    }
  }
}

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
        customDeck.value = {
          sms: uniqueItems([...customDeck.value.sms, ...data.sms.map(item => item.trim())]),
          reponses: uniqueItems([...customDeck.value.reponses, ...data.reponses.map(item => item.trim())]),
        }
        await syncCustomDeck(`${data.sms.length} SMS et ${data.reponses.length} réponses importés`)
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
          
          customDeck.value = {
            sms: uniqueItems([...customDeck.value.sms, ...data.sms]),
            reponses: uniqueItems([...customDeck.value.reponses, ...data.reponses]),
          }
          await syncCustomDeck(`${data.sms.length} SMS et ${data.reponses.length} réponses importés`)
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

async function addManualResponses() {
  try {
    const responses = parseCustomResponses(manualResponsesInput.value)

    if (responses.length === 0) {
      importStatus.value = {
        type: 'error',
        message: 'Ajoute au moins une réponse valide',
      }
      return
    }

    customDeck.value = {
      sms: customDeck.value.sms,
      reponses: uniqueItems([...customDeck.value.reponses, ...responses]),
    }

    manualResponsesInput.value = ''
    await syncCustomDeck(`${responses.length} réponse${responses.length > 1 ? 's' : ''} ajoutée${responses.length > 1 ? 's' : ''}`)
  } catch (err) {
    importStatus.value = {
      type: 'error',
      message: 'Erreur: ' + err.message,
    }
  }
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
