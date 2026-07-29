import { useBankroll } from '../context/BankrollContext'

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  win: 'Win',
  loss: 'Loss',
}

const POSITIVE_TYPES = new Set(['deposit', 'win'])

export default function History() {
  const { history } = useBankroll()

  return (
    <div className="page">
      <h2>Bankroll History</h2>

      {history.length === 0 ? (
        <p className="empty-state">No entries yet. Log your first deposit or session on the Dashboard.</p>
      ) : (
        <ul className="history-list">
          {history.map((entry) => {
            const positive = POSITIVE_TYPES.has(entry.type)
            return (
              <li key={entry.id} className={`history-row type-${entry.type}`}>
                <div className="history-main">
                  <span className="history-type">{TYPE_LABELS[entry.type]}</span>
                  {entry.note && <span className="history-note">{entry.note}</span>}
                  <span className="history-date">
                    {new Date(entry.date).toLocaleString()}
                  </span>
                </div>
                <div className="history-amounts">
                  <span className={`history-amount ${positive ? 'positive' : 'negative'}`}>
                    {positive ? '+' : '-'}${entry.amount.toFixed(2)}
                  </span>
                  <span className="history-balance">Balance: ${entry.balanceAfter.toFixed(2)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
