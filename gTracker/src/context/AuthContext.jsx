import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

const USERS_KEY = 'gtracker_users'
const SESSION_KEY = 'gtracker_current_user'

function loadUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '{}')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem(SESSION_KEY))

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, user)
    else localStorage.removeItem(SESSION_KEY)
  }, [user])

  function login(username, password) {
    const users = loadUsers()
    if (!users[username] || users[username] !== password) {
      return { ok: false, error: 'Invalid username or password.' }
    }
    setUser(username)
    return { ok: true }
  }

  function register(username, password) {
    const users = loadUsers()
    if (users[username]) {
      return { ok: false, error: 'That username is already taken.' }
    }
    users[username] = password
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    setUser(username)
    return { ok: true }
  }

  function logout() {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
