import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const BankrollContext = createContext(null)

function storageKey(username) {
  return `gtracker_bankroll_${username}`
}

function loadState(username) {
  const raw = localStorage.getItem(storageKey(username))
  return raw ? JSON.parse(raw) : { balance: 0, history: [] }
}

export function BankrollProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(() => (user ? loadState(user) : { balance: 0, history: [] }))

  useEffect(() => {
    setState(user ? loadState(user) : { balance: 0, history: [] })
  }, [user])

  useEffect(() => {
    if (user) localStorage.setItem(storageKey(user), JSON.stringify(state))
  }, [user, state])

  function addTransaction({ type, amount, note }) {
    setState((prev) => {
      const signedAmount = type === 'withdrawal' || type === 'loss' ? -amount : amount
      const balance = prev.balance + signedAmount
      const entry = {
        id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        date: new Date().toISOString(),
        type,
        amount,
        note,
        balanceAfter: balance,
      }
      return { balance, history: [entry, ...prev.history] }
    })
  }

  return (
    <BankrollContext.Provider value={{ balance: state.balance, history: state.history, addTransaction }}>
      {children}
    </BankrollContext.Provider>
  )
}

export function useBankroll() {
  return useContext(BankrollContext)
}
