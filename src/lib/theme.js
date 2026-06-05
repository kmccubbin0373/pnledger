// Resolve and apply the color theme to the document root.
// theme: 'light' | 'dark' | 'system' (or undefined = system).
export function applyTheme(theme) {
  let resolved = theme
  if (theme === 'system' || !theme) {
    resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', resolved)
  return resolved
}
