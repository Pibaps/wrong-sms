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
    // Ensure we have at least one non-judge player
    if (players.length === 0) return false
    return players.every(([, player]) => player.playedCard !== null && player.playedCard !== undefined && player.playedCard !== '')
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
    // Créer une copie pour ne pas modifier l'original
    const deckCopy = [...deck]
    const cards = []
    for (let i = 0; i < count && deckCopy.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * deckCopy.length)
      cards.push(deckCopy.splice(randomIndex, 1)[0])
    }
    // Retourner à la fois les cartes et le deck restant
    return { cards, remaining: deckCopy }
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
      winnerReveal: null,
    }

    await set(dbRef(db, `rooms/${code}`), roomData)
    
    // Save to localStorage for persistence
    localStorage.setItem('currentRoomCode', code)
    localStorage.setItem('isHost', 'true')
    
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

    // Allow joining even if game started - will play next round
    roomCode.value = upperCode
    isHost.value = false

    await set(dbRef(db, `rooms/${upperCode}/players/${playerId.value}`), {
      name: playerName.value,
      score: 0,
      hand: [],
      playedCard: null,
      ready: true,
    })

    // Save to localStorage for persistence
    localStorage.setItem('currentRoomCode', upperCode)
    localStorage.setItem('isHost', 'false')

    listenToRoom(upperCode)
    gameState.value = roomData.gameState === 'playing' ? 'playing' : 'lobby'
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
    let cardsUsed = 0

    for (const pId of players) {
      const result = dealCards(deckRemaining.reponses, 7)
      updates[`players/${pId}/hand`] = result.cards
      deckRemaining.reponses = result.remaining
    }

    // Pick first SMS
    const smsResult = dealCards(deckRemaining.sms, 1)
    const firstSms = smsResult.cards[0]
    deckRemaining.sms = smsResult.remaining

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

    // Show winner reveal to everyone
    await update(dbRef(db, `rooms/${roomCode.value}`), {
      winnerReveal: {
        playerName: winner.name,
        card: winningCard.text,
        playerId: winnerId
      }
    })

    // Update score
    const newScore = (winner.score || 0) + 1
    await update(dbRef(db, `rooms/${roomCode.value}/players/${winnerId}`), {
      score: newScore,
    })

    // Next round after delay
    await new Promise(resolve => setTimeout(resolve, 4000))
    await update(dbRef(db, `rooms/${roomCode.value}`), {
      winnerReveal: null
    })
    await nextRound(winnerId)
  }

  async function nextRound(newJudge) {
    const deckRemaining = { ...room.value.deckRemaining }
    
    // Get all current players
    const currentPlayers = Object.keys(room.value.players)
    
    // Check if we still have enough players
    if (currentPlayers.length < 3) {
      // Not enough players, end game
      await endGame()
      return
    }
    
    // Deal cards to refill hands for all players
    const updates = {}
    for (const [pId, player] of Object.entries(room.value.players)) {
      // New player joining mid-game gets full hand
      if (!player.hand || player.hand.length === 0) {
        const result = dealCards(deckRemaining.reponses, 7)
        updates[`players/${pId}/hand`] = result.cards
        deckRemaining.reponses = result.remaining
      } else if (player.hand.length < 7) {
        const needed = 7 - player.hand.length
        const result = dealCards(deckRemaining.reponses, needed)
        updates[`players/${pId}/hand`] = [...player.hand, ...result.cards]
        deckRemaining.reponses = result.remaining
      }
      updates[`players/${pId}/playedCard`] = null
    }

    // Pick new SMS
    if (deckRemaining.sms.length === 0) {
      deckRemaining.sms = [...room.value.deck.sms]
    }
    const smsResult = dealCards(deckRemaining.sms, 1)
    const newSms = smsResult.cards[0]
    deckRemaining.sms = smsResult.remaining

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
    // Security check: ensure all non-judge players have played
    if (!allPlayersPlayed.value) {
      return
    }
    
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
      // Remove player from room
      await remove(dbRef(db, `rooms/${roomCode.value}/players/${playerId.value}`))
      
      // If host leaves, transfer host to another player or delete room
      if (isHost.value) {
        const roomRef = dbRef(db, `rooms/${roomCode.value}`)
        const snapshot = await get(roomRef)
        
        if (snapshot.exists()) {
          const roomData = snapshot.val()
          const remainingPlayers = Object.keys(roomData.players || {})
          
          if (remainingPlayers.length > 0) {
            // Transfer host to first remaining player
            const newHost = remainingPlayers[0]
            await update(dbRef(db, `rooms/${roomCode.value}`), {
              host: newHost,
            })
          } else {
            // No players left, delete room
            await remove(dbRef(db, `rooms/${roomCode.value}`))
          }
        }
      }
    }
    
    // Clear localStorage
    localStorage.removeItem('currentRoomCode')
    localStorage.removeItem('isHost')
    
    roomCode.value = ''
    isHost.value = false
    gameState.value = 'home'
    room.value = null
    currentPlayer.value = null
  }

  async function rejoinRoom() {
    const savedRoomCode = localStorage.getItem('currentRoomCode')
    const savedIsHost = localStorage.getItem('isHost') === 'true'
    
    if (!savedRoomCode) return false
    
    try {
      const roomRef = dbRef(db, `rooms/${savedRoomCode}`)
      const snapshot = await get(roomRef)
      
      if (!snapshot.exists()) {
        // Room doesn't exist anymore, clear storage
        localStorage.removeItem('currentRoomCode')
        localStorage.removeItem('isHost')
        return false
      }
      
      const roomData = snapshot.val()
      
      // Check if player still exists in room
      if (!roomData.players[playerId.value]) {
        // Re-add player with proper state
        const playerData = {
          name: playerName.value,
          score: 0,
          hand: [],
          playedCard: null,
          ready: true,
        }
        
        // If game is in progress, player will get cards next round
        await set(dbRef(db, `rooms/${savedRoomCode}/players/${playerId.value}`), playerData)
      }
      
      roomCode.value = savedRoomCode
      isHost.value = roomData.host === playerId.value // Update host status based on room data
      listenToRoom(savedRoomCode)
      
      // Set correct game state
      if (roomData.gameState === 'playing') {
        gameState.value = 'playing'
      } else if (roomData.gameState === 'results') {
        gameState.value = 'results'
      } else {
        gameState.value = 'lobby'
      }
      
      return true
    } catch (error) {
      console.error('Error rejoining room:', error)
      localStorage.removeItem('currentRoomCode')
      localStorage.removeItem('isHost')
      return false
    }
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
    rejoinRoom,
  }
})
