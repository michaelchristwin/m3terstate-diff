import { useState, useEffect } from 'react'

export function useViewportHeight() {
  const [height, setHeight] = useState(
    window.visualViewport?.height ?? window.innerHeight,
  )

  useEffect(() => {
    const vv = window.visualViewport

    const update = () => {
      setHeight(vv?.height ?? window.innerHeight)
    }

    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update) // address bar collapses on scroll on some browsers
    } else {
      window.addEventListener('resize', update)
    }
    window.addEventListener('orientationchange', update) // covers rotation on older browsers

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      } else {
        window.removeEventListener('resize', update)
      }
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return height
}
