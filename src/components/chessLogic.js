import { ref, computed, watch } from 'vue'
import { useScreenSize } from '../composables/useScreenSize.js'

// Globální stav pro ELO, aby se zachoval i při restartu hry v rámci relace
const whiteElo = ref(1200)
const blackElo = ref(1200)
export const eloHistory = ref([{ white: 1200, black: 1200 }])

// Správa uživatelů
const users = ref(JSON.parse(localStorage.getItem('chess_users') || '{}'))
export const currentUser = ref(null)

const saveUsers = () => {
  localStorage.setItem('chess_users', JSON.stringify(users.value))
}

export const login = (username) => {
  if (!username.trim()) return
  const name = username.trim()
  
  if (users.value[name]) {
    // Načtení existujícího uživatele
    const data = users.value[name]
    whiteElo.value = data.whiteElo
    blackElo.value = data.blackElo
    eloHistory.value = data.eloHistory
  } else {
    // Vytvoření nového uživatele
    whiteElo.value = 1200
    blackElo.value = 1200
    eloHistory.value = [{ white: 1200, black: 1200 }]
    users.value[name] = {
      whiteElo: 1200,
      blackElo: 1200,
      eloHistory: [{ white: 1200, black: 1200 }]
    }
    saveUsers()
  }
  currentUser.value = name
  localStorage.setItem('chess_last_user', name)
}

export const logout = () => {
  currentUser.value = null
  localStorage.removeItem('chess_last_user')
  // Reset hodnot pro "nepřihlášeného" (nebo pro další přihlášení)
  whiteElo.value = 1200
  blackElo.value = 1200
  eloHistory.value = [{ white: 1200, black: 1200 }]
}

// Automatické přihlášení posledního uživatele
const lastUser = localStorage.getItem('chess_last_user')
if (lastUser) {
  login(lastUser)
}

export function useChessGame() {
  const board = ref([])
  const selectedSquare = ref(null)
  const turn = ref('white')
  const validMoves = ref([])
  const isCheck = ref(false)
  const winner = ref(null)
  const lastMove = ref(null)
  const showPromotionModal = ref(false)
  const promotionMove = ref(null)
  const capturedPieces = ref({ white: [], black: [] })
  const textHistory = ref([])
  const history = ref([])
  const isSoundEnabled = ref(true)
  const eloChanges = ref(null)
  const isRankedGame = ref(true)

  // Detekce velikosti obrazovky a škálování
  const { windowWidth, windowHeight, isMobile } = useScreenSize()

  const boardStyle = computed(() => {
    // Maximální šířka šachovnice (včetně okrajů a popisků)
    const maxBoardWidth = 600
    // Dostupná šířka (okno mínus padding)
    const availableWidth = Math.min(windowWidth.value - 20, maxBoardWidth)
    // Výpočet velikosti jednoho políčka (10 sloupců: 8 herních + 2 popisky)
    const cellSize = Math.floor((availableWidth - 30) / 10) // -30 pro border (2x15px)

    return {
      '--cell-size': `${cellSize}px`,
      '--piece-size': `${cellSize * 0.65}px`,
      '--label-size': `${cellSize * 0.35}px`
    }
  })

  const startTime = ref(null)
  const elapsedTime = ref(0)
  const timerInterval = ref(null)

  const formattedTime = computed(() => {
    const minutes = Math.floor(elapsedTime.value / 60).toString().padStart(2, '0');
    const seconds = (elapsedTime.value % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 }

  const whiteScore = computed(() => capturedPieces.value.white.reduce((acc, p) => acc + pieceValues[p.type], 0))
  const blackScore = computed(() => capturedPieces.value.black.reduce((acc, p) => acc + pieceValues[p.type], 0))

  const sounds = typeof Audio !== 'undefined' ? {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_common/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_common/default/capture.mp3'),
    gameover: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_common/default/game-end.mp3')
  } : {}

  const playSound = (type) => {
    if (!isSoundEnabled.value) return
    try {
      if (sounds[type]) {
        sounds[type].currentTime = 0
        sounds[type].play().catch(() => {})
      }
    } catch (e) {}
  }

  const initializeBoard = () => {
    const pieces = ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜']
    const types = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
    const newBoard = []
    
    for (let r = 0; r < 8; r++) {
      const row = []
      for (let c = 0; c < 8; c++) {
        let piece = null
        if (r === 1) piece = { icon: '♟', color: 'black', type: 'pawn', hasMoved: false }
        else if (r === 6) piece = { icon: '♟', color: 'white', type: 'pawn', hasMoved: false }
        else if (r === 0) piece = { icon: pieces[c], color: 'black', type: types[c], hasMoved: false }
        else if (r === 7) piece = { icon: pieces[c], color: 'white', type: types[c], hasMoved: false }
        else row.push(null)
        
        if (piece) row.push(piece)
      }
      newBoard.push(row)
    }
    return newBoard
  }

  const stopTimer = () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }
  }

  const startTimer = () => {
    stopTimer();
    startTime.value = Date.now();
    elapsedTime.value = 0;
    timerInterval.value = setInterval(() => {
      if (!winner.value) {
        elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000);
      }
    }, 1000);
  }

  const isPathBlocked = (fromR, fromC, toR, toC) => {
    const dx = Math.sign(toC - fromC)
    const dy = Math.sign(toR - fromR)
    
    let r = fromR + dy
    let c = fromC + dx
    
    while (r !== toR || c !== toC) {
      if (board.value[r][c]) return true
      r += dy
      c += dx
    }
    return false
  }

  const isSquareUnderAttack = (r, c, defenderColor) => {
    const attackerColor = defenderColor === 'white' ? 'black' : 'white'
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board.value[i][j]
        if (piece && piece.color === attackerColor) {
          if (piece.type === 'pawn') {
            const direction = piece.color === 'white' ? -1 : 1
            // Pěšec útočí šikmo
            if (i + direction === r && Math.abs(j - c) === 1) return true
          } else {
            // Pro ostatní figurky použijeme isValidMove bez kontroly rošády (prevence rekurze)
            if (isValidMove(piece, i, j, r, c, false)) return true
          }
        }
      }
    }
    return false
  }

  const isValidMove = (piece, fromR, fromC, toR, toC, checkCastling = true) => {
    const dx = toC - fromC
    const dy = toR - fromR
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    
    if (board.value[toR][toC] && board.value[toR][toC].color === piece.color) return false

    const direction = piece.color === 'white' ? -1 : 1

    switch (piece.type) {
      case 'pawn': // Pěšec
        if (dx === 0 && dy === direction && !board.value[toR][toC]) return true
        const startRow = piece.color === 'white' ? 6 : 1
        if (dx === 0 && dy === 2 * direction && fromR === startRow && !board.value[toR][toC] && !board.value[fromR + direction][fromC]) return true
        if (absDx === 1 && dy === direction && board.value[toR][toC] && board.value[toR][toC].color !== piece.color) return true
        // En Passant (Beraní z průchodu)
        if (absDx === 1 && dy === direction && !board.value[toR][toC] && lastMove.value) {
          const { from, to } = lastMove.value
          if (to.r === fromR && to.c === toC && Math.abs(from.r - to.r) === 2 && board.value[fromR][toC] && board.value[fromR][toC].type === 'pawn' && board.value[fromR][toC].color !== piece.color) {
            return true
          }
        }
        return false
      case 'rook': // Věž
        if (dx !== 0 && dy !== 0) return false
        return !isPathBlocked(fromR, fromC, toR, toC)
      case 'knight': // Jezdec
        return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2)
      case 'bishop': // Střelec
        if (absDx !== absDy) return false
        return !isPathBlocked(fromR, fromC, toR, toC)
      case 'queen': // Dáma
        if ((dx !== 0 && dy !== 0) && (absDx !== absDy)) return false
        return !isPathBlocked(fromR, fromC, toR, toC)
      case 'king': // Král
        if (absDx <= 1 && absDy <= 1) return true
        // Rošáda
        if (checkCastling && !piece.hasMoved && dy === 0 && absDx === 2) {
          const row = piece.color === 'white' ? 7 : 0
          if (fromR !== row) return false
          if (isSquareUnderAttack(fromR, fromC, piece.color)) return false // Král nesmí být v šachu

          if (dx === 2) { // Malá rošáda (Kingside)
            const rook = board.value[row][7]
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) return false
            if (isPathBlocked(fromR, fromC, row, 7)) return false
            if (isSquareUnderAttack(row, fromC + 1, piece.color) || isSquareUnderAttack(row, fromC + 2, piece.color)) return false
            return true
          } else if (dx === -2) { // Velká rošáda (Queenside)
            const rook = board.value[row][0]
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) return false
            if (isPathBlocked(fromR, fromC, row, 0)) return false
            if (isSquareUnderAttack(row, fromC - 1, piece.color) || isSquareUnderAttack(row, fromC - 2, piece.color)) return false
            return true
          }
        }
        return false
      default:
        return false
    }
  }

  const findKing = (color) => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board.value[r][c]
        if (p && p.type === 'king' && p.color === color) return { r, c }
      }
    }
    return null
  }

  const isKingInCheck = (color) => {
    const kingPos = findKing(color)
    if (!kingPos) return false
    return isSquareUnderAttack(kingPos.r, kingPos.c, color)
  }

  watch(winner, (newWinner) => {
    if (newWinner) {
      stopTimer()

      if (!isRankedGame.value) return

      // Algoritmus ELO
      const kFactor = 32

      // 1. Očekávaná šance (Expected Score)
      const expectedWhite = 1 / (1 + Math.pow(10, (blackElo.value - whiteElo.value) / 400))
      const expectedBlack = 1 / (1 + Math.pow(10, (whiteElo.value - blackElo.value) / 400))

      // 2. Nové ELO (Rating Update)
      const whiteResult = newWinner === 'white' ? 1 : (newWinner === 'black' ? 0 : 0.5)
      const whiteChange = Math.round(kFactor * (whiteResult - expectedWhite))
      const blackChange = Math.round(kFactor * ((1 - whiteResult) - expectedBlack))

      whiteElo.value += whiteChange
      blackElo.value += blackChange
      eloChanges.value = { white: whiteChange, black: blackChange }
      eloHistory.value.push({ white: whiteElo.value, black: blackElo.value })
      
      // Uložení dat uživatele po hře
      if (currentUser.value) {
        users.value[currentUser.value] = {
          whiteElo: whiteElo.value,
          blackElo: blackElo.value,
          eloHistory: eloHistory.value
        }
        saveUsers()
      }
    }
  })

  const hasLegalMoves = (color) => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board.value[r][c]
        if (piece && piece.color === color) {
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              if (isValidMove(piece, r, c, i, j)) {
                const originalTarget = board.value[i][j]
                board.value[i][j] = piece
                board.value[r][c] = null
                const kingInCheck = isKingInCheck(color)
                board.value[r][c] = piece
                board.value[i][j] = originalTarget
                if (!kingInCheck) return true
              }
            }
          }
        }
      }
    }
    return false
  }

  const calculateValidMoves = (r, c) => {
    const piece = board.value[r][c]
    const moves = []
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (isValidMove(piece, r, c, i, j)) {
          // Simulace tahu pro ověření, zda král nezůstane v šachu
          const originalTarget = board.value[i][j]
          board.value[i][j] = piece
          board.value[r][c] = null
          
          if (!isKingInCheck(piece.color)) {
            moves.push(`${i},${j}`)
          }
          
          // Vrácení desky do původního stavu
          board.value[r][c] = piece
          board.value[i][j] = originalTarget
        }
      }
    }
    validMoves.value = moves
  }

  const performMove = (fromR, fromC, toR, toC, promotionType = null) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const moveString = `${files[fromC]}${8 - fromR}-${files[toC]}${8 - toR}`
    textHistory.value.push(moveString)

    // Store state *after* the move
    const stateToPush = {
      board: null, // will be filled later
      capturedPieces: null,
      turn: null,
      isCheck: null,
      lastMove: null,
      moveNotation: moveString
    }

    const piece = board.value[fromR][fromC]
    const targetPiece = board.value[toR][toC]
    let isCapture = !!targetPiece
    
    const capturedValue = targetPiece ? pieceValues[targetPiece.type] : 0
    const movedValue = pieceValues[piece.type]

    if (targetPiece) {
      capturedPieces.value[turn.value].push(targetPiece)
    }

    // Provedení En Passant (odstranění soupeřova pěšce)
    if (piece.type === 'pawn' && Math.abs(toC - fromC) === 1 && !board.value[toR][toC]) {
      const capturedPawn = board.value[fromR][toC]
      if (capturedPawn) {
        capturedPieces.value[turn.value].push(capturedPawn)
        isCapture = true
      }
      board.value[fromR][toC] = null
    }

    // Provedení rošády (pohyb věže)
    if (piece.type === 'king' && Math.abs(toC - fromC) === 2) {
      const row = toR
      if (toC === 6) { // Malá
        const rook = board.value[row][7]
        board.value[row][5] = rook
        board.value[row][7] = null
        rook.hasMoved = true
      } else if (toC === 2) { // Velká
        const rook = board.value[row][0]
        board.value[row][3] = rook
        board.value[row][0] = null
        rook.hasMoved = true
      }
    }

    lastMove.value = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } }

    board.value[toR][toC] = piece
    board.value[fromR][fromC] = null
    piece.hasMoved = true

    if (promotionType) {
      piece.type = promotionType
      const icons = { queen: '♛', rook: '♜', bishop: '♝', knight: '♞' }
      piece.icon = icons[promotionType]
    }

    selectedSquare.value = null
    validMoves.value = []
    turn.value = turn.value === 'white' ? 'black' : 'white'
    isCheck.value = isKingInCheck(turn.value)
    
    if (!hasLegalMoves(turn.value)) {
      if (isCheck.value) {
        winner.value = turn.value === 'white' ? 'black' : 'white'
      } else {
        winner.value = 'draw'
      }
    }

    let moveQuality = 'Normalni'
    if (winner.value) {
      moveQuality = 'Nejlepsi'
    } else {
      const isThreatened = isSquareUnderAttack(toR, toC, piece.color)
      if (isThreatened && movedValue > capturedValue) {
        moveQuality = movedValue >= 5 ? 'Nejhorsi' : 'Spatny'
      } else if (isCheck.value) {
        moveQuality = 'Dobry'
      } else if (capturedValue > movedValue) {
        moveQuality = 'Nejlepsi'
      } else if (capturedValue > 0) {
        moveQuality = 'Dobry'
      }
    }

    if (winner.value) {
      playSound('gameover')
    } else if (isCapture) {
      playSound('capture')
    } else {
      playSound('move')
    }

    stateToPush.board = JSON.parse(JSON.stringify(board.value))
    stateToPush.capturedPieces = JSON.parse(JSON.stringify(capturedPieces.value))
    stateToPush.turn = turn.value
    stateToPush.isCheck = isCheck.value
    stateToPush.lastMove = JSON.parse(JSON.stringify(lastMove.value))
    stateToPush.moveQuality = moveQuality
    history.value.push(stateToPush)
  }

  const undoMove = () => {
    if (history.value.length <= 1) return false // Nelze vrátit začátek hry

    // Odstraníme aktuální stav
    history.value.pop()
    textHistory.value.pop()

    // Obnovíme předchozí stav
    const prevState = history.value[history.value.length - 1]
    board.value = JSON.parse(JSON.stringify(prevState.board))
    capturedPieces.value = JSON.parse(JSON.stringify(prevState.capturedPieces))
    turn.value = prevState.turn
    isCheck.value = prevState.isCheck
    lastMove.value = prevState.lastMove ? JSON.parse(JSON.stringify(prevState.lastMove)) : null
    winner.value = null
    return true
  }

  const promotePawn = (type) => {
    if (!promotionMove.value) return
    const { fromR, fromC, toR, toC } = promotionMove.value
    performMove(fromR, fromC, toR, toC, type)
    showPromotionModal.value = false
    promotionMove.value = null
  }

  const handleSquareClick = (r, c) => {
    if (winner.value) return

    const clickedContent = board.value[r][c]
    
    if (selectedSquare.value) {
      // Pokud klikneme na stejné políčko, zrušíme výběr
      if (selectedSquare.value.r === r && selectedSquare.value.c === c) {
        selectedSquare.value = null
        validMoves.value = []
        return
      }

      // Pokud klikneme na jinou figurku stejné barvy (hráče na tahu), změníme výběr
      if (clickedContent && clickedContent.color === turn.value) {
        selectedSquare.value = { r, c }
        calculateValidMoves(r, c)
        return
      }

      const piece = board.value[selectedSquare.value.r][selectedSquare.value.c]
      
      if (validMoves.value.includes(`${r},${c}`)) {
        // Check for promotion
        if (piece.type === 'pawn' && (r === 0 || r === 7)) {
          promotionMove.value = { fromR: selectedSquare.value.r, fromC: selectedSquare.value.c, toR: r, toC: c }
          showPromotionModal.value = true
          return
        }
        performMove(selectedSquare.value.r, selectedSquare.value.c, r, c)
      } else {
        selectedSquare.value = null
        validMoves.value = []
      }
    } else {
      // Výběr figurky - pouze pokud je na řadě
      if (clickedContent && clickedContent.color === turn.value) {
        selectedSquare.value = { r, c }
        calculateValidMoves(r, c)
      }
    }
  }

  const resetGame = () => {
    board.value = initializeBoard()
    selectedSquare.value = null
    turn.value = 'white'
    validMoves.value = []
    isCheck.value = false
    winner.value = null
    lastMove.value = null
    showPromotionModal.value = false
    promotionMove.value = null
    capturedPieces.value = { white: [], black: [] }
    textHistory.value = []
    history.value = []
    eloChanges.value = null
    startTimer()
    board.value = initializeBoard()
    history.value.push({
      board: JSON.parse(JSON.stringify(board.value)),
      capturedPieces: { white: [], black: [] },
      turn: 'white',
      isCheck: false,
      lastMove: null,
      moveNotation: '',
      moveQuality: null
    })
  }

  const setRankedMode = (ranked) => {
    isRankedGame.value = ranked
  }

  resetGame()
  
  return {
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
    isValidMove,
    isKingInCheck,
    isSquareUnderAttack,
    performMove,
    startTimer,
    formattedTime,
    history,
    undoMove,
    isSoundEnabled,
    whiteElo,
    blackElo,
    eloChanges,
    setRankedMode,
    isMobile,
    boardStyle
  }
}