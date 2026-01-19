import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { ref as dbRef, set, onValue, push, remove, get, update } from 'firebase/database'
import { defaultDeck } from '@/data/defaultDeck'

export const useGameStore = defineStore('game', () => {
  // State
  const playerName = ref(localStorage.getItem('playerName') || '')
  const playerId = ref(localStorage.getItem('playerId') || generateId())
  const roomCode = ref('')
  const isHost = ref(false)
  const gameState = ref('home') // home, lobby, playing, results
  const room = ref(null)
  const currentPlayer = ref(null)
  const winnerReveal = ref(null) // Pour afficher le gagnant de la manche

  // Computed
  const isJudge = computed(() => {
    if (!room.value || !currentPlayer.value) return false
    return room.value.currentJudge === playerId.value
  })

  const otherPlayers = computed(() => {
    if (!room.value?.players) return []
    return Object.entries(room.value.players)
      .filter(([id]) => id !== playerId.value)
      .map(([id, player]) => ({ id, ...player }))
  })

  const allPlayersReady = computed(() => {
    if (!room.value?.players) return false
    const players = Object.values(room.value.players)
    return players.length >= 3 && players.every(p => p.ready)
  })

  const allPlayersPlayed = computed(() => {
    if (!room.value?.players) return false
    const players = Object.entries(room.value.players).filter(([id]) => id !== room.value.currentJudge)
    return players.every(([, player]) => player.playedCard !== null)
  })

  // Helper functions
  function generateId() {
    return Math.random().toString(36).substring(2, 15)
  }

  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  function shuffleArray(array) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function dealCards(deck, count) {
    const cards = []
    for (let i = 0; i < count && deck.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * deck.length)
      cards.push(deck.splice(randomIndex, 1)[0])
    }
    return cards
  }

  // Actions
  function setPlayerName(name) {
    playerName.value = name
    localStorage.setItem('playerName', name)
    localStorage.setItem('playerId', playerId.value)
  }

  async function createRoom() {
    const code = generateRoomCode()
    roomCode.value = code
    isHost.value = true

    const roomData = {
      host: playerId.value,
      gameState: 'lobby',
      currentJudge: null,
      currentSms: null,
      players: {
        [playerId.value]: {
          name: playerName.value,
          score: 0,
          hand: [],
          playedCard: null,
          ready: true,
        }
      },
      deck: { ...defaultDeck },
      deckRemaining: {
        sms: [...defaultDeck.sms],
        reponses: [...defaultDeck.reponses],
      },
      playedCards: [],
      round: 0,
    }

    await set(dbRef(db, `rooms/${code}`), roomData)
    listenToRoom(code)
    gameState.value = 'lobby'
  }

  async function joinRoom(code) {
    const upperCode = code.toUpperCase()
    const roomRef = dbRef(db, `rooms/${upperCode}`)
    const snapshot = await get(roomRef)

    if (!snapshot.exists()) {
      throw new Error('Room not found')
    }

    const roomData = snapshot.val()
    
    if (Object.keys(roomData.players).length >= 10) {
      throw new Error('Room is full')
    }

    if (roomData.gameState !== 'lobby') {
      throw new Error('Game already started')
    }

    roomCode.value = upperCode
    isHost.value = false

    await set(dbRef(db, `rooms/${upperCode}/players/${playerId.value}`), {
      name: playerName.value,
      score: 0,
      hand: [],
      playedCard: null,
      ready: true,
    })

    listenToRoom(upperCode)
    gameState.value = 'lobby'
  }

  function listenToRoom(code) {
    const roomRef = dbRef(db, `rooms/${code}`)
    onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        room.value = snapshot.val()
        currentPlayer.value = room.value.players[playerId.value]
        
        // Sync game state
        if (room.value.gameState === 'playing') {
          gameState.value = 'playing'
        } else if (room.value.gameState === 'results') {
          gameState.value = 'results'
        }
      } else {
        // Room deleted
        leaveRoom()
      }
    })
  }

  async function updateDeck(newDeck) {
    if (!isHost.value) return
    
    const mergedDeck = {
      sms: [...defaultDeck.sms, ...(newDeck.sms || [])],
      reponses: [...defaultDeck.reponses, ...(newDeck.reponses || [])],
    }

    await update(dbRef(db, `rooms/${roomCode.value}`), {
      deck: mergedDeck,
      deckRemaining: {
        sms: [...mergedDeck.sms],
        reponses: [...mergedDeck.reponses],
      }
    })
  }

  async function startGame() {
    if (!isHost.value || !allPlayersReady.value) return

    const players = Object.keys(room.value.players)
    const firstJudge = players[Math.floor(Math.random() * players.length)]
    
    // Deal cards to all players
    const deckRemaining = { ...room.value.deckRemaining }
    const updates = {}

    for (const pId of players) {
      const hand = dealCards(deckRemaining.reponses, 7)
      updates[`players/${pId}/hand`] = hand
    }

    // Pick first SMS
    const firstSms = deckRemaining.sms.splice(Math.floor(Math.random() * deckRemaining.sms.length), 1)[0]

    await update(dbRef(db, `rooms/${roomCode.value}`), {
      ...updates,
      gameState: 'playing',
      currentJudge: firstJudge,
      currentSms: firstSms,
      deckRemaining,
      round: 1,
    })
  }

  async function playCard(cardIndex) {
    if (isJudge.value || !currentPlayer.value) return

    const card = currentPlayer.value.hand[cardIndex]
    const newHand = currentPlayer.value.hand.filter((_, i) => i !== cardIndex)

    await update(dbRef(db, `rooms/${roomCode.value}/players/${playerId.value}`), {
      hand: newHand,
      playedCard: card,
    })
  }

  async function selectWinner(cardIndex) {
    if (!isJudge.value) return

    const winningCard = room.value.playedCards[cardIndex]
    const winnerId = winningCard.playerId
    const winner = room.value.players[winnerId]

    // Show winner reveal
    winnerReveal.value = {
      playerName: winner.name,
      card: winningCard.text,
      playerId: winnerId
    }

    // Update score
    const newScore = (winner.score || 0) + 1
    await update(dbRef(db, `rooms/${roomCode.value}/players/${winnerId}`), {
      score: newScore,
    })

    // Next round after delay
    await new Promise(resolve => setTimeout(resolve, 4000))
    winnerReveal.value = null
    await nextRound(winnerId)
  }

  async function nextRound(newJudge) {
    const deckRemaining = { ...room.value.deckRemaining }
    
    // Deal cards to refill hands
    const updates = {}
    for (const [pId, player] of Object.entries(room.value.players)) {
      if (player.hand.length < 7) {
        const needed = 7 - player.hand.length
        const newCards = dealCards(deckRemaining.reponses, needed)
        updates[`players/${pId}/hand`] = [...player.hand, ...newCards]
      }
      updates[`players/${pId}/playedCard`] = null
    }

    // Pick new SMS
    if (deckRemaining.sms.length === 0) {
      deckRemaining.sms = [...room.value.deck.sms]
    }
    const newSms = deckRemaining.sms.splice(Math.floor(Math.random() * deckRemaining.sms.length), 1)[0]

    await update(dbRef(db, `rooms/${roomCode.value}`), {
      ...updates,
      currentJudge: newJudge,
      currentSms: newSms,
      deckRemaining,
      playedCards: [],
      round: (room.value.round || 0) + 1,
    })
  }

  async function revealCards() {
    // Create shuffled array of played cards with player IDs
    const playedCards = Object.entries(room.value.players)
      .filter(([id, player]) => id !== room.value.currentJudge && player.playedCard)
      .map(([id, player]) => ({
        text: player.playedCard,
        playerId: id,
      }))

    if (playedCards.length === 0) return

    const shuffled = shuffleArray(playedCards)

    // Update Firebase with the revealed cards
    await update(dbRef(db, `rooms/${roomCode.value}`), {
      playedCards: shuffled,
    })
  }

  async function endGame() {
    if (!isHost.value) return
    gameState.value = 'results'
    await update(dbRef(db, `rooms/${roomCode.value}`), {
      gameState: 'results',
    })
  }

  async function leaveRoom() {
    if (roomCode.value && playerId.value) {
      await remove(dbRef(db, `rooms/${roomCode.value}/players/${playerId.value}`))
      
      // If host leaves, delete room
      if (isHost.value) {
        await remove(dbRef(db, `rooms/${roomCode.value}`))
      }
    }
    
    roomCode.value = ''
    isHost.value = false
    gameState.value = 'home'
    room.value = null
    currentPlayer.value = null
    winnerReveal.value = null
  }

  return {
    // State
    playerName,
    playerId,
    roomCode,
    isHost,
    gameState,
    room,
    currentPlayer,
    winnerReveal,
    
    // Computed
    isJudge,
    otherPlayers,
    allPlayersReady,
    allPlayersPlayed,
    
    // Actions
    setPlayerName,
    createRoom,
    joinRoom,
    updateDeck,
    startGame,
    playCard,
    selectWinner,
    revealCards,
    endGame,
    leaveRoom,
  }
})
