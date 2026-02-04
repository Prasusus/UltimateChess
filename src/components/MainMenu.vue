<script setup>
import { ref, computed } from 'vue'
import { eloHistory, login, logout, currentUser } from './chessLogic.js'

const emit = defineEmits(['start-game'])

const step = ref('main') // main, mode, opponent, difficulty
const isRanked = ref(true)

const selectMode = (ranked) => {
  isRanked.value = ranked
  step.value = 'opponent'
}

const selectOpponent = (type) => {
  if (type === 'human') {
    emit('start-game', { vsComputer: false, isRanked: isRanked.value })
  } else {
    step.value = 'difficulty'
  }
}

const selectDifficulty = (level) => {
  emit('start-game', { vsComputer: true, difficulty: level, isRanked: isRanked.value })
}

const showGraph = ref(false)

const graphData = computed(() => {
  if (eloHistory.value.length < 2) return null
  
  const width = 600
  const height = 300
  const padding = 40
  
  const allValues = eloHistory.value.map(e => e.white)
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(max - min, 50)
  
  const getPoints = () => {
    return eloHistory.value.map((entry, i) => {
      const x = padding + (i / (eloHistory.value.length - 1)) * (width - 2 * padding)
      const y = height - padding - ((entry.white - min) / range) * (height - 2 * padding)
      return `${x},${y}`
    }).join(' ')
  }

  return {
    points: getPoints(),
    min, max,
    current: eloHistory.value[eloHistory.value.length - 1].white
  }
})

const username = ref('')

const handleLogin = () => {
  if (username.value) {
    login(username.value)
  }
}
</script>

<template>
  <div class="main-menu">
    <div class="background-pieces">
      <span class="bg-piece piece-1">♜</span>
      <span class="bg-piece piece-2">♞</span>
      <span class="bg-piece piece-3">♝</span>
      <span class="bg-piece piece-4">♛</span>
      <span class="bg-piece piece-5">♚</span>
    </div>

    <div class="menu-card">
      <h1 class="title">Šachy</h1>

      <!-- Přihlašovací obrazovka -->
      <div v-if="!currentUser" class="menu-options">
        <input v-model="username" @keyup.enter="handleLogin" placeholder="Zadejte jméno" class="menu-input" />
        <button @click="handleLogin" class="menu-btn">Přihlásit se</button>
      </div>
      
      <!-- Hlavní menu (zobrazí se jen přihlášeným) -->
      <template v-else>
        <div class="user-info">
          Přihlášen: <strong>{{ currentUser }}</strong>
        </div>

        <div v-if="step === 'main'" class="menu-options">
          <button @click="step = 'mode'" class="menu-btn">Hrát</button>
          <button @click="showGraph = true" class="menu-btn">Graf ELO</button>
          <button @click="logout" class="menu-btn back-btn">Odhlásit se</button>
        </div>

        <div v-if="step === 'mode'" class="menu-options">
          <button @click="selectMode(true)" class="menu-btn">Hodnocená hra (ELO)</button>
          <button @click="selectMode(false)" class="menu-btn">Přátelská hra</button>
          <button @click="step = 'main'" class="menu-btn back-btn">Zpět</button>
        </div>

        <div v-if="step === 'opponent'" class="menu-options">
          <button @click="selectOpponent('human')" class="menu-btn">Hráč vs Hráč</button>
          <button @click="selectOpponent('computer')" class="menu-btn">Hráč vs Počítač</button>
          <button @click="step = 'mode'" class="menu-btn back-btn">Zpět</button>
        </div>

        <div v-if="step === 'difficulty'" class="menu-options">
          <button @click="selectDifficulty('easy')" class="menu-btn">Lehká</button>
          <button @click="selectDifficulty('medium')" class="menu-btn">Střední</button>
          <button @click="selectDifficulty('hard')" class="menu-btn">Těžká</button>
          <button @click="selectDifficulty('professional')" class="menu-btn">Profesionál</button>
          <button @click="step = 'opponent'" class="menu-btn back-btn">Zpět</button>
        </div>
      </template>
    </div>

    <div v-if="showGraph" class="graph-overlay">
      <div class="graph-card">
        <h2>Vývoj ELO</h2>
        <div class="graph-container" v-if="graphData">
          <svg viewBox="0 0 600 300" class="elo-graph">
            <polyline :points="graphData.points" fill="none" stroke="#fff" stroke-width="3" />
          </svg>
          <div class="legend">
            <span class="legend-item white">Moje ELO: {{ graphData.current }}</span>
          </div>
        </div>
        <p v-else>Nedostatek dat pro zobrazení grafu. Odehrajte alespoň jednu hodnocenou hru.</p>
        <button @click="showGraph = false" class="menu-btn back-btn">Zavřít</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  background-color: #333;
  color: #f0d9b5;
  position: relative;
  overflow: hidden;
}

.menu-card {
  background-color: rgba(44, 44, 44, 0.9);
  padding: 50px;
  border-radius: 20px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
  border: 1px solid #555;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
  backdrop-filter: blur(5px);
  min-width: 400px;
}

.title {
  font-size: 4rem;
  margin-bottom: 3rem;
  text-transform: uppercase;
  letter-spacing: 5px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.menu-options {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.menu-btn {
  background-color: #444;
  color: white;
  border: 2px solid #888;
  padding: 20px 40px;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 8px;
  min-width: 300px;
}

.menu-btn:hover {
  background-color: #555;
  border-color: #f0d9b5;
  transform: scale(1.05);
}

.back-btn {
  background-color: #5a2a2a;
  border-color: #843d3d;
}

.background-pieces {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.bg-piece {
  position: absolute;
  font-size: 20rem;
  color: rgba(240, 217, 181, 0.05);
  user-select: none;
}

.piece-1 {
  top: 5%;
  left: 5%;
  transform: rotate(-15deg);
}
.piece-2 {
  top: 15%;
  right: 5%;
  transform: rotate(15deg);
  font-size: 25rem;
}
.piece-3 {
  bottom: 5%;
  left: 5%;
  transform: rotate(10deg);
}
.piece-4 {
  bottom: 10%;
  right: 5%;
  transform: rotate(-20deg);
  font-size: 18rem;
}
.piece-5 {
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(5deg);
  font-size: 30rem;
  opacity: 0.03;
}

.graph-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.graph-card {
  background-color: #2c2c2c;
  padding: 30px;
  border-radius: 15px;
  border: 2px solid #555;
  width: 700px;
  text-align: center;
  color: #f0d9b5;
}

.graph-container {
  margin: 20px 0;
  background-color: #222;
  border-radius: 8px;
  padding: 10px;
  border: 1px solid #444;
}

.elo-graph {
  width: 100%;
  height: auto;
  background-color: #333;
  border-radius: 4px;
}

.legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 10px;
}

.legend-item {
  font-weight: bold;
}

.legend-item.white { color: #fff; }
.legend-item.black { color: #aaa; }

.menu-input {
  padding: 15px;
  font-size: 1.2rem;
  border-radius: 8px;
  border: 2px solid #888;
  background-color: #444;
  color: white;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.user-info {
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: #ccc;
}
</style>