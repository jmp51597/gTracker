import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const HandHistoryContext = createContext(null)

function storageKey(username) {
  return `gtracker_hands_${username}`
}

function loadHands(username) {
  const raw = localStorage.getItem(storageKey(username))
  return raw ? JSON.parse(raw) : []
}

export function HandHistoryProvider({ children }) {
  const { user } = useAuth()
  const [hands, setHands] = useState(() => (user ? loadHands(user) : []))

  useEffect(() => {
    setHands(user ? loadHands(user) : [])
  }, [user])

  useEffect(() => {
    if (user) localStorage.setItem(storageKey(user), JSON.stringify(hands))
  }, [user, hands])

  function saveHand(hand) {
    const entry = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      date: new Date().toISOString(),
      ...hand,
    }
    setHands((prev) => [entry, ...prev])
    return entry
  }

  function deleteHand(id) {
    setHands((prev) => prev.filter((hand) => hand.id !== id))
  }

  return (
    <HandHistoryContext.Provider value={{ hands, saveHand, deleteHand }}>
      {children}
    </HandHistoryContext.Provider>
  )
}

export function useHandHistory() {
  return useContext(HandHistoryContext)
}
