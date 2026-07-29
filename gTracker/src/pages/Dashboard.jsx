import { useState } from 'react'
import { useBankroll } from '../context/BankrollContext'

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  win: 'Win',
  loss: 'Loss',
}

export default function Dashboard() {
  const { balance, addTransaction } = useBankroll()
  const [type, setType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number.parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return
    addTransaction({ type, amount: value, note: note.trim() })
    setAmount('')
    setNote('')
  }

  return (
    <div className="page">
      <section className="balance-card">
        <span className="balance-label">Current Bankroll</span>
        <span className="balance-value">${balance.toFixed(2)}</span>
      </section>

      <form className="entry-form" onSubmit={handleSubmit}>
        <h2>Log an entry</h2>

        <div className="type-picker">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`type-option${type === value ? ' active' : ''}`}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <label>
          Amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label>
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Blackjack at the casino"
          />
        </label>

        <button type="submit">Add {TYPE_LABELS[type]}</button>
      </form>
    </div>
  )
}
