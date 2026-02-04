import { ref, watch } from 'vue'

export function useAiLogic(game) {
  // Načteme potřebné funkce a stav z herní logiky
  const { board, turn, winner, performMove, isValidMove, isKingInCheck, isSquareUnderAttack } = game
  
  const isAiEnabled = ref(false)
  const aiDifficulty = ref('medium')
  const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 }

  const makeAiMove = () => {
    // AI hraje pouze pokud je zapnutá, je na tahu černý a hra neskončila
    if (winner.value || !isAiEnabled.value || turn.value !== 'black') return

    const possibleMoves = []

    // 1. Najdeme všechny možné legální tahy pro černého
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board.value[r][c]
        // Hledáme pouze černé figurky
        if (piece && piece.color === 'black') {
          // Zkoušíme pohyb na všechna políčka šachovnice
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              // Pokud je tah geometricky platný podle pravidel pohybu figurky
              if (isValidMove(piece, r, c, i, j)) {
                // Musíme ověřit, zda tah nezpůsobí šach vlastnímu králi
                const originalTarget = board.value[i][j]
                
                // Simulace tahu
                board.value[i][j] = piece
                board.value[r][c] = null
                
                const kingSafe = !isKingInCheck('black')
                
                // Vrácení desky do původního stavu
                board.value[r][c] = piece
                board.value[i][j] = originalTarget

                // Pokud je král v bezpečí, tah je legální
                if (kingSafe) {
                  let score = 0
                  
                  // Hodnocení tahu
                  if (originalTarget) {
                    score += pieceValues[originalTarget.type] * 10
                  }

                  // Jednoduchá strategie: vyhnout se ohroženým políčkům (pro vyšší obtížnosti)
                  if (aiDifficulty.value !== 'easy') {
                    board.value[i][j] = piece
                    board.value[r][c] = null
                    if (isSquareUnderAttack(i, j, 'black')) {
                      score -= pieceValues[piece.type] * 10
                    }
                    board.value[r][c] = piece
                    board.value[i][j] = originalTarget
                  }

                  // Malý náhodný faktor
                  score += Math.random() * 0.5

                  possibleMoves.push({ 
                    move: { from: { r, c }, to: { r: i, c: j } },
                    score
                  })
                }
              }
            }
          }
        }
      }
    }

    if (possibleMoves.length > 0) {
      // Seřadit tahy podle skóre sestupně
      possibleMoves.sort((a, b) => b.score - a.score)

      let selectedMove = null
      
      if (aiDifficulty.value === 'easy') {
        selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)].move
      } else if (aiDifficulty.value === 'medium') {
        // Střední: Náhodný tah z horní poloviny
        const limit = Math.ceil(possibleMoves.length * 0.5)
        selectedMove = possibleMoves[Math.floor(Math.random() * limit)].move
      } else if (aiDifficulty.value === 'hard') {
        // Těžká: Náhodný tah z top 3
        const limit = Math.min(3, possibleMoves.length)
        selectedMove = possibleMoves[Math.floor(Math.random() * limit)].move
      } else {
        // Profesionál: Vždy nejlepší tah
        selectedMove = possibleMoves[0].move
      }
      
      let promotionType = null
      const piece = board.value[selectedMove.from.r][selectedMove.from.c]
      if (piece.type === 'pawn' && selectedMove.to.r === 7) {
        promotionType = 'queen'
      }
      
      // Provedení tahu
      performMove(
        selectedMove.from.r, 
        selectedMove.from.c, 
        selectedMove.to.r, 
        selectedMove.to.c, 
        promotionType
      )
    }
  }

  // Sledujeme změnu tahu. Pokud je na řadě černý a AI je zapnutá, provedeme tah.
  watch([turn, isAiEnabled], ([newTurn, enabled]) => {
    if (enabled && newTurn === 'black' && !winner.value) {
      // Malé zpoždění, aby to vypadalo, že AI "přemýšlí"
      setTimeout(makeAiMove, 500)
    }
  })

  const setDifficulty = (level) => {
    aiDifficulty.value = level
  }

  return {
    isAiEnabled,
    setDifficulty
  }
}
