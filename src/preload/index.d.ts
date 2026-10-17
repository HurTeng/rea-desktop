import type { DesktopApi } from '../shared/types'

declare global {
  interface Window {
    rea: DesktopApi
  }
}
export {}
