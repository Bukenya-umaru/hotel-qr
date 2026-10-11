export const THEME_KEY = 'wagabits-theme'

export const readTheme = () => {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export const applyTheme = theme => {
  const next = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', next === 'dark' ? '#171412' : '#faf3f0')
  try { localStorage.setItem(THEME_KEY, next) } catch { /* storage may be blocked */ }
  return next
}

export const toggleTheme = theme => applyTheme(theme === 'dark' ? 'light' : 'dark')
