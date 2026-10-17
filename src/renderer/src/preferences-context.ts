import { createContext, useContext } from 'react'
import type { Language } from '../../shared/locale'

export type Theme = 'light' | 'dark'
export interface Preferences {
  theme: Theme
  language: Language
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  t: (text: string, values?: Record<string, string | number>) => string
}
export const PreferencesContext = createContext<Preferences | null>(null)
export function usePreferences(): Preferences {
  return useContext(PreferencesContext)!
}
