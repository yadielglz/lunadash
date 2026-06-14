import { useEffect } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'
type ControllerKey = Direction | 'ok'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
].join(',')

function getControllerKey(event: KeyboardEvent): ControllerKey | null {
  switch (event.key) {
    case 'ArrowUp':
    case 'Up':
      return 'up'
    case 'ArrowDown':
    case 'Down':
      return 'down'
    case 'ArrowLeft':
    case 'Left':
      return 'left'
    case 'ArrowRight':
    case 'Right':
      return 'right'
    case 'Enter':
    case 'NumpadEnter':
    case ' ':
    case 'Spacebar':
    case 'Select':
      return 'ok'
    default:
      break
  }

  // Android WebView and kiosk shells often expose DPAD keys only through keyCode.
  switch (event.keyCode || event.which) {
    case 19:
      return 'up'
    case 20:
      return 'down'
    case 21:
      return 'left'
    case 22:
      return 'right'
    case 23:
    case 66:
      return 'ok'
    default:
      return null
  }
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  return ['INPUT', 'TEXTAREA'].includes(element.tagName)
}

function isVisibleFocusable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') return false
  if (element.closest('[inert], [aria-hidden="true"]')) return false

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const style = window.getComputedStyle(element)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

function getFocusableElements() {
  return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisibleFocusable)
}

function focusElement(element: HTMLElement) {
  element.focus({ preventScroll: true })
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function scoreCandidate(from: DOMRect, to: DOMRect, direction: Direction) {
  const fromX = from.left + from.width / 2
  const fromY = from.top + from.height / 2
  const toX = to.left + to.width / 2
  const toY = to.top + to.height / 2
  const deltaX = toX - fromX
  const deltaY = toY - fromY

  if (direction === 'up' && deltaY >= -1) return Number.POSITIVE_INFINITY
  if (direction === 'down' && deltaY <= 1) return Number.POSITIVE_INFINITY
  if (direction === 'left' && deltaX >= -1) return Number.POSITIVE_INFINITY
  if (direction === 'right' && deltaX <= 1) return Number.POSITIVE_INFINITY

  const primaryDistance = direction === 'up' || direction === 'down' ? Math.abs(deltaY) : Math.abs(deltaX)
  const crossAxisDistance = direction === 'up' || direction === 'down' ? Math.abs(deltaX) : Math.abs(deltaY)

  return primaryDistance * 10 + crossAxisDistance
}

function moveFocus(direction: Direction) {
  const elements = getFocusableElements()
  if (elements.length === 0) return false

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!active || active === document.body || !elements.includes(active)) {
    focusElement(elements[0])
    return true
  }

  const activeRect = active.getBoundingClientRect()
  const next = elements
    .filter((element) => element !== active)
    .map((element) => ({ element, score: scoreCandidate(activeRect, element.getBoundingClientRect(), direction) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score)[0]?.element

  if (next) {
    focusElement(next)
    return true
  }

  const currentIndex = elements.indexOf(active)
  const offset = direction === 'up' || direction === 'left' ? -1 : 1
  const wrappedIndex = (currentIndex + offset + elements.length) % elements.length
  focusElement(elements[wrappedIndex])
  return true
}

function activateFocusedElement() {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) {
    active.click()
    return true
  }

  const first = getFocusableElements()[0]
  if (!first) return false
  focusElement(first)
  return true
}

export function useControllerInput() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return

      const controllerKey = getControllerKey(event)
      if (!controllerKey) return

      if (isEditableElement(document.activeElement)) return

      const handled = controllerKey === 'ok'
        ? activateFocusedElement()
        : moveFocus(controllerKey)

      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])
}
