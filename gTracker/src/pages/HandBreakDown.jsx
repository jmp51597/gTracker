import { useMemo, useState } from 'react'
import { useHandHistory } from '../context/HandHistoryContext'

// Card shape used throughout this file: { rank: 'A', suit: 'Spades' }
// rank is one of '2'-'9', 'T', 'J', 'Q', 'K', 'A'
// suit is one of 'Hearts', 'Diamonds', 'Clubs', 'Spades'

const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const RANK_VALUES = RANKS.reduce((map, rank, i) => ({ ...map, [rank]: i + 2 }), {})
const SUIT_SYMBOLS = { Hearts: '♥', Diamonds: '♦', Spades: '♠', Clubs: '♣' }
const RED_SUITS = new Set(['Hearts', 'Diamonds'])
const STREETS = ['preflop', 'flop', 'turn', 'river']
const STREET_LABELS = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }
const ACTION_TYPES = ['Bet', 'Raise', 'Call', 'Check', 'Fold']
const AMOUNT_ACTIONS = new Set(['Bet', 'Raise', 'Call'])
const HAND_RANK_ORDER = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
]

function buildDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

const FULL_DECK = buildDeck()

function shuffle(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function getSuitSymbol(suit) {
  return SUIT_SYMBOLS[suit] || '?'
}

function cardKey(card) {
  return card ? `${card.rank}-${card.suit}` : ''
}

function parseCardKey(key) {
  const [rank, suit] = key.split('-')
  return { rank, suit }
}

function emptyStreets() {
  return { preflop: [], flop: [], turn: [], river: [] }
}

/**
 * Sorts ranks numerically (2-10, J=11, Q=12, K=13, A=14).
 * This is crucial for straight checking.
 */
function getRankValues(cardArray) {
  return cardArray.map(card => RANK_VALUES[card.rank] || Number(card.rank) || 0)
}

function getRankCounts(cards) {
  const counts = {}
  cards.forEach(card => {
    counts[card.rank] = (counts[card.rank] || 0) + 1
  })
  return counts
}

function isFlush(cards) {
  const suitCounts = {}
  cards.forEach(card => {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
  })
  return Object.values(suitCounts).some(count => count >= 5)
}

function isStraight(cards) {
  const values = [...new Set(getRankValues(cards))].sort((a, b) => a - b)
  if (values.includes(14)) values.unshift(1) // Ace can also play low (A-2-3-4-5)

  let run = 1
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1] + 1) {
      run++
      if (run >= 5) return true
    } else if (values[i] !== values[i - 1]) {
      run = 1
    }
  }
  return false
}

function getStraightFlushRank(cards) {
  const bySuit = {}
  cards.forEach(card => {
    if (!bySuit[card.suit]) bySuit[card.suit] = []
    bySuit[card.suit].push(card)
  })

  for (const group of Object.values(bySuit)) {
    if (group.length < 5 || !isStraight(group)) continue
    const values = new Set(getRankValues(group))
    if ([10, 11, 12, 13, 14].every(v => values.has(v))) return 'Royal Flush'
    return 'Straight Flush'
  }
  return null
}

/**
 * @param {Array<Object>} cards - All cards available to a player (hole cards + board).
 * @returns {string} - Name of the best hand ("Royal Flush", "Full House", etc.).
 */
function evaluatePokerHand(cards) {
  if (!cards || cards.length < 5) return 'Not enough cards'

  const straightFlush = getStraightFlushRank(cards)
  if (straightFlush) return straightFlush

  const counts = Object.values(getRankCounts(cards)).sort((a, b) => b - a)

  if (counts[0] === 4) return 'Four of a Kind'
  if (counts[0] === 3 && counts[1] >= 2) return 'Full House'
  if (isFlush(cards)) return 'Flush'
  if (isStraight(cards)) return 'Straight'
  if (counts[0] === 3) return 'Three of a Kind'
  if (counts[0] === 2 && counts[1] === 2) return 'Two Pair'
  if (counts[0] === 2) return 'One Pair'
  return 'High Card'
}

// Compares two hand names by rank only (no kicker comparison).
function compareHands(mine, theirs) {
  if (!mine || !theirs) return null
  const diff = HAND_RANK_ORDER.indexOf(mine) - HAND_RANK_ORDER.indexOf(theirs)
  if (diff > 0) return 'you'
  if (diff < 0) return 'opponent'
  return 'tie'
}

function findFold(streets) {
  for (const street of STREETS) {
    const fold = streets[street].find(action => action.type === 'Fold')
    if (fold) return { street, player: fold.player }
  }
  return null
}

function potFromStreets(streets) {
  return STREETS.reduce((sum, street) => {
    return sum + streets[street].reduce((streetSum, action) => streetSum + (action.amount || 0), 0)
  }, 0)
}

function CardSelect({ value, onChange, usedKeys }) {
  const valueKey = cardKey(value)
  return (
    <select
      className="card-select"
      value={valueKey}
      onChange={e => onChange(e.target.value ? parseCardKey(e.target.value) : null)}
    >
      <option value="">--</option>
      {FULL_DECK.map(card => {
        const key = cardKey(card)
        return (
          <option key={key} value={key} disabled={usedKeys.has(key) && key !== valueKey}>
            {card.rank}
            {getSuitSymbol(card.suit)}
          </option>
        )
      })}
    </select>
  )
}

function CardGroupEditable({ label, cards, onChangeAt, usedKeys }) {
  return (
    <div className="card-group-wrap">
      {label && <div className="card-group-label">{label}</div>}
      <div className="card-group">
        {cards.map((card, i) => (
          <div key={i} className="card-slot">
            <CardSelect value={card} onChange={c => onChangeAt(i, c)} usedKeys={usedKeys} />
            {card && (
              <div className={`poker-card ${RED_SUITS.has(card.suit) ? 'suit-red' : 'suit-black'}`}>
                {card.rank}
                <span className="suit">{getSuitSymbol(card.suit)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StaticCards({ cards }) {
  const filled = (cards || []).filter(Boolean)
  if (filled.length === 0) return <span className="empty-state">—</span>
  return (
    <div className="static-cards">
      {filled.map((card, i) => (
        <span key={i} className={`mini-card ${RED_SUITS.has(card.suit) ? 'suit-red' : 'suit-black'}`}>
          {card.rank}
          {getSuitSymbol(card.suit)}
        </span>
      ))}
    </div>
  )
}

function AddActionForm({ onAdd }) {
  const [player, setPlayer] = useState('you')
  const [type, setType] = useState('Bet')
  const [amount, setAmount] = useState('')

  function handleAdd() {
    const needsAmount = AMOUNT_ACTIONS.has(type)
    onAdd({ player, type, amount: needsAmount ? parseFloat(amount) || 0 : 0 })
    setAmount('')
  }

  return (
    <div className="action-form">
      <select value={player} onChange={e => setPlayer(e.target.value)}>
        <option value="you">You</option>
        <option value="opponent">Opponent</option>
      </select>
      <select value={type} onChange={e => setType(e.target.value)}>
        {ACTION_TYPES.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {AMOUNT_ACTIONS.has(type) && (
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
        />
      )}
      <button type="button" onClick={handleAdd}>
        Add
      </button>
    </div>
  )
}

function ActionList({ actions, onRemove }) {
  if (actions.length === 0) return <p className="empty-state">No action yet</p>
  return (
    <ul className="action-list">
      {actions.map((action, i) => (
        <li key={action.id} className="action-row">
          <span className="action-player">{action.player === 'you' ? 'You' : 'Opponent'}</span>
          <span className="action-type">{action.type}</span>
          {AMOUNT_ACTIONS.has(action.type) && (
            <span className="action-amount">${action.amount.toFixed(2)}</span>
          )}
          <button type="button" className="action-remove" onClick={() => onRemove(i)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function HandBreakDown() {
  const { hands, saveHand, deleteHand } = useHandHistory()

  const [myHand, setMyHand] = useState([null, null])
  const [boardCards, setBoardCards] = useState([null, null, null, null, null])
  const [opponentHand, setOpponentHand] = useState([null, null])
  const [streets, setStreets] = useState(emptyStreets())

  const usedKeys = useMemo(() => {
    const keys = new Set()
    ;[...myHand, ...boardCards, ...opponentHand].forEach(card => {
      if (card) keys.add(cardKey(card))
    })
    return keys
  }, [myHand, boardCards, opponentHand])

  function updateAt(setter) {
    return (index, card) => setter(prev => prev.map((c, i) => (i === index ? card : c)))
  }
  const updateMyHand = updateAt(setMyHand)
  const updateBoard = updateAt(setBoardCards)
  const updateOpponentHand = updateAt(setOpponentHand)

  function addAction(street, action) {
    setStreets(prev => ({
      ...prev,
      [street]: [...prev[street], { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, ...action }],
    }))
  }

  function removeAction(street, index) {
    setStreets(prev => ({
      ...prev,
      [street]: prev[street].filter((_, i) => i !== index),
    }))
  }

  function handleRandomDeal() {
    const deck = shuffle(buildDeck())
    setMyHand(deck.slice(0, 2))
    setOpponentHand(deck.slice(2, 4))
    setBoardCards(deck.slice(4, 9))
  }

  function handleClearCards() {
    setMyHand([null, null])
    setBoardCards([null, null, null, null, null])
    setOpponentHand([null, null])
  }

  function handleResetAll() {
    handleClearCards()
    setStreets(emptyStreets())
  }

  function handleSave() {
    saveHand({ myHand, boardCards, opponentHand, streets, pot, outcome })
  }

  function handleLoad(hand) {
    setMyHand(hand.myHand)
    setBoardCards(hand.boardCards)
    setOpponentHand(hand.opponentHand)
    setStreets(hand.streets)
  }

  const flopCards = boardCards.slice(0, 3)
  const turnCard = boardCards.slice(3, 4)
  const riverCard = boardCards.slice(4, 5)

  const filledBoard = boardCards.filter(Boolean)
  const filledMyHand = myHand.filter(Boolean)
  const filledOpponentHand = opponentHand.filter(Boolean)

  const myResult =
    filledMyHand.length === 2 && filledBoard.length >= 3
      ? evaluatePokerHand([...filledMyHand, ...filledBoard])
      : null

  const opponentResult =
    filledOpponentHand.length === 2 && filledBoard.length >= 3
      ? evaluatePokerHand([...filledOpponentHand, ...filledBoard])
      : null

  const fold = findFold(streets)
  const pot = potFromStreets(streets)

  let outcome = null
  if (fold) {
    const winner = fold.player === 'you' ? 'Opponent' : 'You'
    const folder = fold.player === 'you' ? 'You' : 'Opponent'
    outcome = `${winner} win${winner === 'You' ? '' : 's'} — ${folder} folded on the ${STREET_LABELS[fold.street]}.`
  } else if (myResult && opponentResult) {
    const winner = compareHands(myResult, opponentResult)
    if (winner === 'tie') {
      outcome = `Split pot — both hold ${myResult} (kickers not compared).`
    } else {
      const winnerLabel = winner === 'you' ? 'You win' : 'Opponent wins'
      const winnerHand = winner === 'you' ? myResult : opponentResult
      const loserHand = winner === 'you' ? opponentResult : myResult
      outcome = `${winnerLabel} — ${winnerHand} beats ${loserHand}.`
    }
  } else if (myResult) {
    outcome = `Your hand: ${myResult}. Opponent cards unknown — no showdown comparison.`
  }

  return (
    <div className="page">
      <h2>Hand Breakdown</h2>

      <div className="poker-container">
        <CardGroupEditable label="Your Hand" cards={myHand} onChangeAt={updateMyHand} usedKeys={usedKeys} />

        {STREETS.map(street => (
          <div className="street" key={street}>
            <div className="street-header">
              <span className="street-name">{STREET_LABELS[street]}</span>
            </div>

            {street === 'flop' && (
              <CardGroupEditable cards={flopCards} onChangeAt={updateBoard} usedKeys={usedKeys} />
            )}
            {street === 'turn' && (
              <CardGroupEditable
                cards={turnCard}
                onChangeAt={(i, card) => updateBoard(3 + i, card)}
                usedKeys={usedKeys}
              />
            )}
            {street === 'river' && (
              <CardGroupEditable
                cards={riverCard}
                onChangeAt={(i, card) => updateBoard(4 + i, card)}
                usedKeys={usedKeys}
              />
            )}

            <ActionList actions={streets[street]} onRemove={index => removeAction(street, index)} />
            <AddActionForm onAdd={action => addAction(street, action)} />
          </div>
        ))}

        <CardGroupEditable
          label="Opponent Hand (optional)"
          cards={opponentHand}
          onChangeAt={updateOpponentHand}
          usedKeys={usedKeys}
        />
      </div>

      <div className="pot-summary">Pot: ${pot.toFixed(2)}</div>

      <div className="hand-actions">
        <button type="button" className="deal-button" onClick={handleRandomDeal}>
          Random Deal
        </button>
        <button type="button" className="deal-button secondary" onClick={handleClearCards}>
          Clear Cards
        </button>
        <button type="button" className="deal-button secondary" onClick={handleResetAll}>
          Reset All
        </button>
        <button type="button" className="deal-button" onClick={handleSave}>
          Save Hand
        </button>
      </div>

      {outcome && <p className="hand-result">{outcome}</p>}

      <div className="saved-hands">
        <h3>Saved Hands</h3>
        {hands.length === 0 ? (
          <p className="empty-state">No saved hands yet.</p>
        ) : (
          <ul className="saved-hands-list">
            {hands.map(hand => (
              <li key={hand.id} className="saved-hand-row">
                <div className="saved-hand-main">
                  <StaticCards cards={hand.myHand} />
                  <span className="saved-hand-date">{new Date(hand.date).toLocaleString()}</span>
                </div>
                <div className="saved-hand-board">
                  <StaticCards cards={hand.boardCards} />
                </div>
                <div className="saved-hand-outcome">{hand.outcome || 'Hand in progress'}</div>
                <div className="saved-hand-pot">Pot: ${(hand.pot || 0).toFixed(2)}</div>
                <div className="saved-hand-actions">
                  <button type="button" onClick={() => handleLoad(hand)}>
                    Load
                  </button>
                  <button type="button" onClick={() => deleteHand(hand.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
