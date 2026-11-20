const TOKEN_KEY = 'careai_token'
const USER_KEY  = 'careai_user'

function isTokenExpired(token) {
  try {
    // JWT uses Base64URL (no padding, uses - and _ instead of + and /)
    // atob requires standard Base64 with padding, so we must convert first
    const base64Url = token.split('.')[1]
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded    = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    const payload   = JSON.parse(atob(padded))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export const authUtils = {
  saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  },
  isLoggedIn() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false
    if (isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return false
    }
    return true
  }
}
