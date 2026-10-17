// Apply saved appearance before the first frame; keep the desktop window from flashing.
const savedTheme = localStorage.getItem('rea.theme')
document.documentElement.dataset.theme =
  savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
document.documentElement.lang = localStorage.getItem('rea.language') === 'en' ? 'en' : 'zh-CN'
