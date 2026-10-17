import { useEffect, useRef } from 'react'

export function useDialog(onClose: () => void, busy = false): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  const working = useRef(busy)
  useEffect(() => {
    close.current = onClose
    working.current = busy
  }, [onClose, busy])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    const focusable = (): HTMLElement[] =>
      [
        ...(panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
        ) ?? [])
      ].filter((element) => element.getClientRects().length > 0)
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !working.current) {
        event.preventDefault()
        close.current()
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!panel?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? elements.at(-1) : elements[0])?.focus()
        return
      }
      const first = elements[0],
        last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])
  return ref
}
