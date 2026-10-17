import { useEffect, useLayoutEffect, useState } from 'react'
import { translate, type Language } from '../../shared/locale'

import { PreferencesContext, type Theme } from './preferences-context'

function savedPreference(key: string): string | null {
  return localStorage.getItem(`rea.${key}`)
}

export function PreferencesProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = savedPreference('theme')
    return saved === 'light' || saved === 'dark'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  })
  const [language, setLanguage] = useState<Language>(() =>
    savedPreference('language') === 'en' ? 'en' : 'zh'
  )
  const [ready, setReady] = useState(() => !window.rea)
  useEffect(() => {
    if (!window.rea) return
    void window.rea
      .getPreferences()
      .then((saved) => {
        if (saved) {
          setTheme(saved.theme)
          setLanguage(saved.language)
        }
        setReady(true)
      })
      .catch((error) => {
        console.error(error)
        setReady(true)
      })
  }, [])
  useEffect(() => {
    if (ready && window.rea)
      void window.rea.savePreferences({ theme, language }).catch(console.error)
  }, [ready, theme, language])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    localStorage.setItem('rea.theme', theme)
    localStorage.setItem('rea.language', language)
  }, [theme, language])
  return (
    <PreferencesContext.Provider
      value={{
        theme,
        language,
        setTheme,
        setLanguage,
        t: (text, values) => translate(text, language, values)
      }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}
