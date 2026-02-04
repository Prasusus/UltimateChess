<script setup>
import { ref } from 'vue'
import ChessBoard from './components/ChessBoard.vue'
import MainMenu from './components/MainMenu.vue'

const currentView = ref('menu')
const isVsComputer = ref(false)
const aiDifficulty = ref('medium')
const isRanked = ref(true)

const startGame = ({ vsComputer, difficulty, isRanked: ranked }) => {
  isVsComputer.value = vsComputer
  if (difficulty) aiDifficulty.value = difficulty
  isRanked.value = ranked
  currentView.value = 'game'
}

const quitGame = () => {
  currentView.value = 'menu'
}
</script>

<template>
  <MainMenu v-if="currentView === 'menu'" @start-game="startGame" />
  <ChessBoard v-else :vs-computer="isVsComputer" :difficulty="aiDifficulty" :is-ranked="isRanked" @quit="quitGame" />
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
}

body {
  margin: 0;
  background-color: #333;
}
</style>