<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useChessGame } from './chessLogic.js'
import { useAiLogic } from './aiLogic.js'

const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const numbers = [8, 7, 6, 5, 4, 3, 2, 1]

const props = defineProps({
  vsComputer: Boolean,
  difficulty: String,
  isRanked: Boolean
})

const emit = defineEmits(['quit'])

const game = useChessGame()
const {
  board,
  selectedSquare,
  turn,
  validMoves,
  isCheck,
  winner,
  lastMove,
  showPromotionModal,
  capturedPieces,
  whiteScore,
  blackScore,
  promotePawn,
  handleSquareClick,
  textHistory,
  resetGame,
  startTimer,
  formattedTime,
  history,
  undoMove,
  isSoundEnabled,
  whiteElo,
  blackElo,
  eloChanges,
  setRankedMode
} = game

const { isAiEnabled, setDifficulty } = useAiLogic(game)

const displayedHistory = computed(() => {
  const history = textHistory.value
  const start = Math.max(0, history.length - 5)
  return history.slice(start).map((move, index) => ({
    move,
    number: start + index + 1,
    color: (start + index) % 2 === 0 ? 'white' : 'black'
  }))
})

const showMenu = ref(false)
const isFlipped = ref(false)

const boardRows = computed(() => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7]
  return isFlipped.value ? rows.reverse() : rows
})

const boardCols = computed(() => {
  const cols = [0, 1, 2, 3, 4, 5, 6, 7]
  return isFlipped.value ? cols.reverse() : cols
})

const undo = () => {
  if (props.vsComputer) {
    // Proti PC vrátíme 2 tahy (pokud je na tahu hráč), abychom se vrátili před tah PC
    if (turn.value === 'white' && history.value.length > 2) {
      undoMove() // Vrátí tah PC
      undoMove() // Vrátí tah hráče
    }
  } else {
    undoMove()
  }
}

// --- REPLAY STATE AND LOGIC ---
const showReplay = ref(false)
const replayBoard = ref([])
const replayLastMove = ref(null)
const replayTurn = ref('white')
const replayIsCheck = ref(false)
const currentMoveIndex = ref(0)
const isPlayingReplay = ref(false)
let replayTimer = null

function startReplay() {
  showReplay.value = true
  currentMoveIndex.value = 0
  updateReplayState(0)
}

function closeReplay() {
  showReplay.value = false
  stopAutoplay()
}

function updateReplayState(index) {
  const state = history.value[index]
  if (state) {
    replayBoard.value = state.board
    replayLastMove.value = state.lastMove
    replayTurn.value = state.turn
    replayIsCheck.value = state.isCheck
  }
}

watch(currentMoveIndex, (newIndex) => {
  updateReplayState(parseInt(newIndex, 10))
})

function prevMove() {
  if (currentMoveIndex.value > 0) currentMoveIndex.value--
}

function nextMove() {
  if (currentMoveIndex.value < history.value.length - 1) {
    currentMoveIndex.value++
  } else {
    stopAutoplay()
  }
}

function stopAutoplay() {
  if (replayTimer) {
    clearInterval(replayTimer)
    replayTimer = null
    isPlayingReplay.value = false
  }
}

function toggleAutoplay() {
  if (isPlayingReplay.value) {
    stopAutoplay()
  } else {
    isPlayingReplay.value = true
    if (currentMoveIndex.value >= history.value.length - 1) {
      currentMoveIndex.value = 0
    }
    replayTimer = setInterval(() => {
      nextMove()
    }, 800)
  }
}
// --- END REPLAY ---

const getQualityIcon = (quality) => {
  switch (quality) {
    case 'Nejlepsi': return '★★'
    case 'Dobry': return '★'
    case 'Normalni': return '●'
    case 'Spatny': return '!'
    case 'Nejhorsi': return '!!'
    default: return ''
  }
}

const getQualityClass = (quality) => {
  switch (quality) {
    case 'Nejlepsi': return 'quality-best'
    case 'Dobry': return 'quality-good'
    case 'Normalni': return 'quality-normal'
    case 'Spatny': return 'quality-bad'
    case 'Nejhorsi': return 'quality-worst'
    default: return ''
  }
}

const handleKeydown = (e) => {
  if (showReplay.value) {
    if (e.key === 'ArrowLeft') {
      prevMove()
    } else if (e.key === 'ArrowRight') {
      nextMove()
    } else if (e.key === 'Escape') {
      closeReplay()
    }
  } else if (e.key === 'Escape') {
    showMenu.value = !showMenu.value
  }
}

const startNewGame = () => {
  resetGame()
  showMenu.value = false
}

const quitGame = () => {
  emit('quit')
}

const onSquareClick = (r, c) => {
  if (isAiEnabled.value && turn.value === 'black') return
  handleSquareClick(r, c)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.vsComputer) {
    isAiEnabled.value = true
    if (props.difficulty) {
      setDifficulty(props.difficulty)
    }
  }
  setRankedMode(props.isRanked)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="game-container">
    <div class="game-info-bar">
      <div class="turn-indicator" v-if="!winner">
        Na tahu: <span :class="turn">{{ turn === 'white' ? 'Bílý' : 'Černý' }}</span> <span v-if="isCheck" style="color: #ff4444; font-weight: bold;">(ŠACH!)</span>
      </div>
      <div class="timer" v-if="!winner">
        Čas: {{ formattedTime }}
      </div>
    </div>

    <div class="controls-bar" v-if="!winner && !showReplay">
      <button @click="undo" class="control-btn" :disabled="history.length <= 1 || (vsComputer && history.length <= 2)">↺ Vrátit tah</button>
      <button @click="isFlipped = !isFlipped" class="control-btn">⇄ Otočit</button>
      <button @click="showMenu = true" class="control-btn menu-trigger">Menu</button>
    </div>

    <div v-if="showMenu" class="menu-overlay">
      <div class="menu-box">
        <h2>Pauza</h2>
        <button @click="showMenu = false" class="menu-btn">Pokračovat</button>
        <button @click="startNewGame" class="menu-btn">Nová hra</button>
        <button @click="isSoundEnabled = !isSoundEnabled" class="menu-btn">Zvuky: {{ isSoundEnabled ? 'Zapnuto' : 'Vypnuto' }}</button>
        <button @click="quitGame" class="menu-btn danger">Odejít z utkání</button>
      </div>
    </div>

    <div v-if="showPromotionModal" class="promotion-overlay">
      <div class="promotion-menu">
        <h3>Vyberte povýšení</h3>
        <div class="promotion-options">
          <div @click="promotePawn('queen')" class="promotion-option">♛</div>
          <div @click="promotePawn('rook')" class="promotion-option">♜</div>
          <div @click="promotePawn('bishop')" class="promotion-option">♝</div>
          <div @click="promotePawn('knight')" class="promotion-option">♞</div>
        </div>
      </div>
    </div>

    <div v-if="winner" class="game-over-overlay">
      <div class="game-over-menu">
        <h2>Konec hry</h2>
        <p v-if="winner === 'draw'">Remíza (Pat)</p>
        <p v-else>Vítěz: {{ winner === 'white' ? 'Bílý' : 'Černý' }}</p>
        <p class="game-time">Celkový čas: {{ formattedTime }}</p>
        <p class="elo-change" v-if="eloChanges">
          ELO změna: Bílý {{ eloChanges.white > 0 ? '+' : '' }}{{ eloChanges.white }}, 
          Černý {{ eloChanges.black > 0 ? '+' : '' }}{{ eloChanges.black }}
        </p>
        <button @click="startReplay" class="menu-btn">Zobrazit záznam</button>
        <button @click="quitGame" class="menu-btn continue-btn">Pokračovat</button>
      </div>
    </div>

    <div v-if="showReplay" class="replay-overlay">
      <div class="replay-container">
        <div class="chess-board">
          <div class="corner"></div>
          <div v-for="l in letters" :key="'top-replay-'+l" class="label">{{ l }}</div>
          <div class="corner"></div>
          <template v-for="(n, rIndex) in numbers" :key="'replay-'+n">
            <div class="label">{{ n }}</div>
            <div 
              v-for="(l, cIndex) in letters" 
              :key="'replay-'+n+l" 
              class="block"
              :class="[
                (rIndex + cIndex) % 2 === 0 ? 'square-white' : 'square-black',
                replayLastMove && ((replayLastMove.from.r === rIndex && replayLastMove.from.c === cIndex) || (replayLastMove.to.r === rIndex && replayLastMove.to.c === cIndex)) ? 'last-move' : ''
              ]"
            >
              <span v-if="replayBoard[rIndex]?.[cIndex]" class="piece" :class="replayBoard[rIndex][cIndex].color">
                {{ replayBoard[rIndex][cIndex].icon }}
              </span>
              <div v-if="replayIsCheck && replayBoard[rIndex]?.[cIndex]?.type === 'king' && replayBoard[rIndex][cIndex].color === replayTurn" class="check-indicator">!!</div>
              <div v-if="history[currentMoveIndex]?.lastMove?.to.r === rIndex && history[currentMoveIndex]?.lastMove?.to.c === cIndex && history[currentMoveIndex]?.moveQuality" 
                   class="board-quality-icon" 
                   :class="getQualityClass(history[currentMoveIndex].moveQuality)">
                {{ getQualityIcon(history[currentMoveIndex].moveQuality) }}
              </div>
            </div>
            <div class="label">{{ n }}</div>
          </template>
          <div class="corner"></div>
          <div v-for="l in letters" :key="'bot-replay-'+l" class="label">{{ l }}</div>
          <div class="corner"></div>
        </div>
        <div class="replay-controls">
          <p class="move-info">
            Tah: {{ currentMoveIndex }} / {{ history.length - 1 }} 
            <span class="move-notation">{{ history[currentMoveIndex]?.moveNotation }}</span>
            <span v-if="history[currentMoveIndex]?.moveQuality" class="move-quality" :class="getQualityClass(history[currentMoveIndex].moveQuality)">
              {{ getQualityIcon(history[currentMoveIndex].moveQuality) }}
            </span>
          </p>
          <input type="range" min="0" :max="history.length - 1" v-model="currentMoveIndex" class="replay-slider" />
          <div class="replay-buttons">
            <button @click="currentMoveIndex = 0" :disabled="currentMoveIndex <= 0" class="replay-btn replay-arrow-btn">|&lt;</button>
            <button @click="prevMove" :disabled="currentMoveIndex <= 0" class="replay-btn replay-arrow-btn">&lt;</button>
            <button @click="toggleAutoplay" class="replay-btn" :class="isPlayingReplay ? 'replay-stop-btn' : 'replay-play-btn'">{{ isPlayingReplay ? 'Pauza' : 'Přehrát' }}</button>
            <button @click="nextMove" :disabled="currentMoveIndex >= history.length - 1" class="replay-btn replay-arrow-btn">&gt;</button>
            <button @click="currentMoveIndex = history.length - 1" :disabled="currentMoveIndex >= history.length - 1" class="replay-btn replay-arrow-btn">&gt;|</button>
            <button @click="closeReplay" class="replay-btn danger">Zavřít</button>
          </div>
        </div>
      </div>
    </div>

  <div class="board-layout">
    <div class="chess-board">
      <!-- Horní popisky -->
      <div class="corner"></div>
      <div v-for="l in letters" :key="'top-'+l" class="label">{{ l }}</div>
      <div class="corner"></div>

      <!-- Řádky šachovnice -->
      <template v-for="rIndex in boardRows" :key="rIndex">
        <div class="label">{{ numbers[rIndex] }}</div>
        <div 
          v-for="cIndex in boardCols" 
          :key="rIndex+'-'+cIndex" 
          class="block"
          :class="[
            (rIndex + cIndex) % 2 === 0 ? 'square-white' : 'square-black',
            selectedSquare && selectedSquare.r === rIndex && selectedSquare.c === cIndex ? 'selected' : '',
            lastMove && ((lastMove.from.r === rIndex && lastMove.from.c === cIndex) || (lastMove.to.r === rIndex && lastMove.to.c === cIndex)) ? 'last-move' : ''
          ]"
          @click="onSquareClick(rIndex, cIndex)"
        >
          <div v-if="validMoves.includes(`${rIndex},${cIndex}`)" class="valid-move-dot"></div>
          <span 
            v-if="board[rIndex][cIndex]" 
            class="piece" 
            :class="board[rIndex][cIndex].color"
          >
            {{ board[rIndex][cIndex].icon }}
          </span>
          <div v-if="isCheck && board[rIndex][cIndex] && board[rIndex][cIndex].type === 'king' && board[rIndex][cIndex].color === turn" class="check-indicator">!!</div>
        </div>
        <div class="label">{{ numbers[rIndex] }}</div>
      </template>

      <!-- Spodní popisky -->
      <div class="corner"></div>
      <div v-for="l in letters" :key="'bot-'+l" class="label">{{ l }}</div>
      <div class="corner"></div>
    </div>

    <div class="score-board">
      <div class="score-section">
        <h3>Bílý ({{ whiteScore }}) <span v-if="isRanked" class="elo-badge">{{ whiteElo }}</span></h3>
        <div class="captured-list">
          <span v-for="(p, i) in capturedPieces.white" :key="i" class="piece" :class="p.color">{{ p.icon }}</span>
        </div>
      </div>
      <div class="score-section">
        <h3>Černý ({{ blackScore }}) <span v-if="isRanked" class="elo-badge">{{ blackElo }}</span></h3>
        <div class="captured-list">
          <span v-for="(p, i) in capturedPieces.black" :key="i" class="piece" :class="p.color">{{ p.icon }}</span>
        </div>
      </div>
      <div class="history-section">
        <h3>Historie tahů</h3>
        <div class="move-list">
          <div v-for="(item, index) in displayedHistory" :key="item.number" 
               class="move-item"
               :class="{ 
                 'last-move': index === displayedHistory.length - 1,
                 'white-move': item.color === 'white',
                 'black-move': item.color === 'black'
               }">
            <span class="move-number">{{ item.number }}.</span>
            <span class="move-text">{{ item.move }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-top: 20px;
  position: relative;
  background-color: #333;
}

.game-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 600px;
  margin-bottom: 20px;
}

.controls-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.control-btn {
  background-color: #444;
  color: #f0d9b5;
  border: 1px solid #666;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.control-btn:hover:not(:disabled) {
  background-color: #555;
  border-color: #f0d9b5;
  transform: translateY(-1px);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-trigger {
  background-color: #5a4a4a;
}

.board-layout {
  display: flex;
  align-items: flex-start;
  position: relative;
}

.chess-board {
  display: grid;
  grid-template-columns: 60px repeat(8, 60px) 60px;
  grid-template-rows: 60px repeat(8, 60px) 60px;
  background-color: #333;
  margin: 0;
  border: 15px solid #555;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}
.block { 
  width: 60px; 
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.square-white { background-color: #f0d9b5; }
.square-black { background-color: #b58863; }
.last-move { background-color: rgba(205, 210, 106, 0.6) !important; }
.selected { background-color: rgba(82, 176, 227, 0.7) !important; }
.label { display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.5rem; cursor: default; }

.piece {
  font-size: 40px;
  cursor: pointer;
  line-height: 1;
}
.piece.white { color: #fff; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
.piece.black { color: #000; text-shadow: 0 0 2px rgba(255,255,255,0.4); }

.turn-indicator {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  border: 2px solid #888;
  background-color: #444;
  padding: 10px 25px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.timer {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  border: 2px solid #888;
  background-color: #444;
  padding: 10px 25px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

.turn-indicator span.white {
  color: #fff;
}

.turn-indicator span.black {
  color: #000;
  text-shadow: 0 0 3px #fff;
}

.valid-move-dot {
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  pointer-events: none;
}

.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.game-over-menu {
  background-color: #333;
  border: 4px solid #f0d9b5;
  padding: 30px 50px;
  border-radius: 15px;
  text-align: center;
  color: white;
  box-shadow: 0 0 30px rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-over-menu h2 {
  font-size: 2.5rem;
  color: #f0d9b5;
  margin: 0;
}

.game-over-menu p {
  font-size: 1.8rem;
  margin: 0;
}

.game-time {
  font-size: 1.2rem !important;
  color: #ccc;
}

.elo-change {
  font-size: 1.4rem !important;
  color: #f0d9b5;
  margin-top: 5px !important;
}

.continue-btn {
  background-color: #4CAF50;
  border-color: #66BB6A;
}

.continue-btn:hover {
  background-color: #5cb85c;
}

.check-indicator {
  position: absolute;
  top: 0;
  right: 0;
  color: #ff4444;
  font-weight: 900;
  font-size: 1.2rem;
  text-shadow: 0 0 2px #000;
  pointer-events: none;
}

.promotion-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.promotion-menu {
  background-color: #333;
  border: 4px solid #f0d9b5;
  padding: 20px;
  border-radius: 15px;
  text-align: center;
  color: white;
  box-shadow: 0 0 30px rgba(0,0,0,0.8);
}

.promotion-options {
  display: flex;
  gap: 15px;
  margin-top: 15px;
}

.promotion-option {
  font-size: 2rem;
  cursor: pointer;
  padding: 10px;
  background-color: #444;
  border-radius: 8px;
  border: 2px solid #888;
  transition: transform 0.2s, background-color 0.2s;
}

.promotion-option:hover {
  transform: scale(1.1);
  background-color: #555;
  border-color: #f0d9b5;
}

.score-board {
  color: white;
  background-color: #333;
  padding: 20px;
  border: 4px solid #555;
  border-radius: 8px;
  width: 350px;
  flex-shrink: 0;
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 20px;
}

.score-section {
  margin-bottom: 20px;
}

.score-section h3 {
  margin-top: 0;
  border-bottom: 1px solid #777;
  padding-bottom: 5px;
}

.elo-badge {
  font-size: 0.8em;
  background-color: #555;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}

.captured-list {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 5px;
  min-height: 80px;
}

.captured-list .piece {
  font-size: 30px;
  justify-self: center;
  cursor: default;
}

.controls {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.undo-btn:hover:not(:disabled) {
  background-color: #555;
  border-color: #f0d9b5;
}

.undo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-btn {
  background-color: #444;
  color: white;
  border: 2px solid #888;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
  margin-left: 10px;
}

.ai-btn.active {
  background-color: #2e7d32;
  border-color: #4caf50;
}

.ai-btn:hover {
  filter: brightness(1.1);
}

.history-section {
  margin-top: 20px;
  border: 2px solid #555;
  background-color: #222;
  padding: 10px;
  border-radius: 8px;
  max-height: 200px;
  display: flex;
  flex-direction: column;
}

.move-list {
  overflow-y: auto;
  padding-right: 5px;
  flex-grow: 1;
}

.move-item {
  margin-bottom: 4px;
  font-family: monospace;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  gap: 10px;
}

.last-move {
  font-weight: bold;
  background-color: #444;
  border: 1px solid #777;
}

.white-move {
  color: #ffffff;
  border-left: 3px solid #ffffff;
}

.black-move {
  color: #b0b0b0;
  border-left: 3px solid #555555;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 300;
  backdrop-filter: blur(5px);
}

.menu-box {
  background-color: #2c2c2c;
  border: 2px solid #555;
  padding: 40px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 300px;
  box-shadow: 0 0 20px rgba(0,0,0,0.8);
}

.menu-box h2 {
  color: #f0d9b5;
  text-align: center;
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 2rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.menu-btn {
  background-color: #444;
  color: white;
  border: 1px solid #666;
  padding: 15px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 5px;
  text-transform: uppercase;
  font-weight: bold;
}

.menu-btn:hover {
  background-color: #555;
  border-color: #888;
  transform: translateY(-2px);
}

.menu-btn.danger {
  background-color: #5a2a2a;
  border-color: #843d3d;
}

.menu-btn.danger:hover {
  background-color: #753535;
}

.replay-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 250;
}

.replay-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.replay-controls {
  background-color: #2c2c2c;
  padding: 15px 25px;
  border-radius: 10px;
  border: 2px solid #555;
  color: white;
  text-align: center;
  width: 700px;
}

.replay-controls h3 {
  margin-top: 0;
  color: #f0d9b5;
}

.move-info {
  font-size: 1.2rem;
  margin: 0 0 10px 0;
}

.move-notation {
  font-weight: bold;
  color: #f0d9b5;
  margin-left: 10px;
}

.replay-slider {
  width: 100%;
  margin-bottom: 15px;
  cursor: pointer;
}

.replay-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 15px;
}

.replay-btn {
  padding: 10px 20px;
  font-size: 1rem;
  font-weight: bold;
  color: white;
  border-radius: 8px;
  border: 1px solid #555;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #444;
}

.replay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.replay-btn:not(:disabled):hover {
  transform: translateY(-1px);
  filter: brightness(1.15);
}

.replay-arrow-btn {
  background-color: #6c757d;
  border-color: #5a6268;
}

.replay-play-btn {
  background-color: #28a745;
  border-color: #218838;
}

.replay-stop-btn {
  background-color: #dc3545;
  border-color: #c82333;
}

.replay-btn.danger {
  background-color: #5a2a2a;
  border-color: #843d3d;
}

.move-quality {
  margin-left: 15px;
  font-size: 1rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  text-transform: uppercase;
}

.quality-best {
  color: #ffd700;
  border: 1px solid #ffd700;
}
.quality-good {
  color: #4caf50;
  border: 1px solid #4caf50;
}
.quality-normal {
  color: #ccc;
  border: 1px solid #777;
}
.quality-bad {
  color: #ff9800;
  border: 1px solid #ff9800;
}
.quality-worst {
  color: #f44336;
  border: 1px solid #f44336;
}

.board-quality-icon {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
  border: none !important;
}
</style>