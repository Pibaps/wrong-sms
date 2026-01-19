<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Logo/Title -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-bold tracking-tight">Wrong SMS</h1>
        <p class="text-gray-400 text-sm">Le jeu de cartes qui fait mal</p>
      </div>

      <!-- Name Input -->
      <div v-if="!hasName" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium mb-2">Votre prénom</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Entrez votre prénom"
            class="input-field"
            maxlength="20"
            @keyup.enter="saveName"
          />
        </div>
        <button
          @click="saveName"
          :disabled="!name.trim()"
          class="btn btn-primary w-full"
        >
          Continuer
        </button>
      </div>

      <!-- Create/Join Options -->
      <div v-else class="space-y-4">
        <div class="bg-secondary rounded-lg p-4 flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400 mb-1">Connecté en tant que</p>
            <p class="font-medium">{{ gameStore.playerName }}</p>
          </div>
          <button
            @click="editName"
            class="text-accent hover:text-blue-400 text-sm"
          >
            Modifier
          </button>
        </div>

        <div class="space-y-3">
          <button
            @click="createRoom"
            class="btn btn-primary w-full"
          >
            Créer une partie
          </button>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-primary text-gray-500">ou</span>
            </div>
          </div>

          <div class="space-y-2">
            <input
              v-model="joinCode"
              type="text"
              placeholder="Code de la partie"
              class="input-field text-center uppercase"
              maxlength="6"
              @keyup.enter="joinRoom"
            />
            <button
              @click="joinRoom"
              :disabled="joinCode.length < 6"
              class="btn btn-secondary w-full"
            >
              Rejoindre
            </button>
          </div>
        </div>

        <div v-if="error" class="bg-red-500/10 border border-red-500 rounded-lg p-3">
          <p class="text-red-500 text-sm">{{ error }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center text-xs text-gray-600 pt-8">
        <p>Jouez entre 3 et 10 joueurs</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const router = useRouter()
const gameStore = useGameStore()

const name = ref(gameStore.playerName)
const joinCode = ref('')
const error = ref('')

const hasName = computed(() => !!gameStore.playerName)

onMounted(async () => {
  // Try to rejoin existing room
  if (gameStore.playerName) {
    const rejoined = await gameStore.rejoinRoom()
    if (rejoined) {
      // Navigate to appropriate page
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

function saveName() {
  if (!name.value.trim()) return
  gameStore.setPlayerName(name.value.trim())
}

function editName() {
  name.value = ''
  gameStore.setPlayerName('')
}

async function createRoom() {
  try {
    error.value = ''
    await gameStore.createRoom()
    router.push('/lobby')
  } catch (err) {
    error.value = 'Erreur lors de la création de la partie'
  }
}

async function joinRoom() {
  try {
    error.value = ''
    await gameStore.joinRoom(joinCode.value)
    router.push('/lobby')
  } catch (err) {
    if (err.message === 'Room not found') {
      error.value = 'Cette partie n\'existe pas'
    } else if (err.message === 'Room is full') {
      error.value = 'Cette partie est complète'
    } else if (err.message === 'Game already started') {
      error.value = 'Cette partie a déjà commencé'
    } else {
      error.value = 'Erreur lors de la connexion'
    }
  }
}
</script>
