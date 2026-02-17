import { ref, onMounted, onUnmounted } from 'vue'

export function useScreenSize() {
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
  const isMobile = ref(false)

  const update = () => {
    if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
      isMobile.value = window.innerWidth < 768
    }
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return { windowWidth, windowHeight, isMobile }
}