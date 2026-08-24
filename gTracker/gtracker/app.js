  /* ============================================================
     FIREBASE SETUP
     Loaded straight from Google's CDN as ES modules — no build
     step, no npm install, this file works as-is when hosted.
     ============================================================ */
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    GoogleAuthProvider, signInWithPopup, signOut
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import {
    getFirestore, collection, addDoc, deleteDoc, doc, query, where, onSnapshot,
    serverTimestamp, orderBy
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  // Public per-project config for the gtracker Firebase project.
  // This is safe to have visible in client-side code — it just tells the SDK
  // which Firebase project to talk to. It is NOT a secret: the real access
  // control is enforced server-side by Firestore security rules (each user
  // can only read/write documents where userId == their own auth uid) and
  // this key is additionally restricted in Google Cloud Console to only
  // work from gtracker's own hosting domains.
  const firebaseConfig = {
    apiKey: "AIzaSyB0go8kz3Nbkv7wwBlZCh67iWHEWj8aPGE",
    authDomain: "gtracker-60774.firebaseapp.com",
    projectId: "gtracker-60774",
    storageBucket: "gtracker-60774.firebasestorage.app",
    messagingSenderId: "366504781967",
    appId: "1:366504781967:web:0cb9e1c5f133f49df1e8fa"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);       // handles sign in/up/out and "who's logged in"
  const db = getFirestore(app);    // the database that stores session data
  const googleProvider = new GoogleAuthProvider();

  // ---- Elements ----
  // Grab every DOM element we'll need to read from or write to, once, up front.
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('appScreen');
  const userBar = document.getElementById('userBar');
  const authTitle = document.getElementById('authTitle');
  const authToggleText = document.getElementById('authToggleText');
  const authToggleLink = document.getElementById('authToggleLink');
  const authError = document.getElementById('authError');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const emailAuthBtn = document.getElementById('emailAuthBtn');
  const googleBtn = document.getElementById('googleBtn');

  const dateInput = document.getElementById('dateInput');
  const gameTypeInput = document.getElementById('gameTypeInput');
  const locationInput = document.getElementById('locationInput');
  const buyInInput = document.getElementById('buyInInput');
  const cashOutInput = document.getElementById('cashOutInput');
  const durationInput = document.getElementById('durationInput');
  const notesInput = document.getElementById('notesInput');
  const addSessionBtn = document.getElementById('addSessionBtn');
  const addError = document.getElementById('addError');
  const sessionList = document.getElementById('sessionList');

  const statSessions = document.getElementById('statSessions');
  const statNet = document.getElementById('statNet');
  const statAvg = document.getElementById('statAvg');
  const statWinRate = document.getElementById('statWinRate');

  // Tab nav elements
  const tabSessionsBtn = document.getElementById('tabSessionsBtn');
  const tabHandBtn = document.getElementById('tabHandBtn');
  const sessionsTab = document.getElementById('sessionsTab');
  const handTab = document.getElementById('handTab');

  let isSignUpMode = false;        // false = "Sign in" form, true = "Create an account" form
  let unsubscribeSessions = null;  // holds the Firestore listener's cancel function (see below)
  let unsubscribeHands = null;     // same, for the Hand Breakdown "Saved Hands" listener

  // Default the date field to today so most users don't have to touch it
  dateInput.valueAsDate = new Date();

  // ---- Tab switching ----
  // Sessions and Hand Breakdown are two independent panels sharing one
  // signed-in app screen; only one is visible at a time.
  function switchTab(tab) {
    const isSessions = tab === 'sessions';
    sessionsTab.style.display = isSessions ? 'block' : 'none';
    handTab.style.display = isSessions ? 'none' : 'block';
    tabSessionsBtn.classList.toggle('active', isSessions);
    tabHandBtn.classList.toggle('active', !isSessions);
  }
  tabSessionsBtn.addEventListener('click', () => switchTab('sessions'));
  tabHandBtn.addEventListener('click', () => switchTab('hand'));

  // ---- Auth mode toggle ----
  // Clicking "Sign up" / "Sign in" flips the form between the two modes by
  // relabeling the title, button and this link's text — it's the same
  // fields underneath, just different labels and which Firebase call gets
  // made on submit (see emailAuthBtn's handler below).
  authToggleLink.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    authTitle.textContent = isSignUpMode ? 'Create an account' : 'Sign in';
    emailAuthBtn.textContent = isSignUpMode ? 'Sign up' : 'Sign in';
    authToggleText.textContent = isSignUpMode ? 'Already have an account? ' : "Don't have an account? ";
    authToggleLink.textContent = isSignUpMode ? 'Sign in' : 'Sign up';
    authError.textContent = '';
  });

  // Email/password submit — calls whichever Firebase Auth function matches
  // the current mode. onAuthStateChanged (below) reacts to the result, so
  // this handler doesn't need to do anything on success.
  emailAuthBtn.addEventListener('click', async () => {
    authError.textContent = '';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      authError.textContent = 'Enter an email and password.';
      return;
    }
    try {
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      authError.textContent = friendlyAuthError(err);
    }
  });

  // Google sign-in — opens Google's popup, Firebase handles the OAuth flow
  googleBtn.addEventListener('click', async () => {
    authError.textContent = '';
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      authError.textContent = friendlyAuthError(err);
    }
  });

  // Firebase Auth errors come back as machine-readable codes like
  // "auth/wrong-password" — this translates the common ones into plain
  // English instead of showing the raw code to the user.
  function friendlyAuthError(err) {
    const code = err.code || '';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect email or password.';
    if (code.includes('user-not-found')) return 'No account with that email.';
    if (code.includes('email-already-in-use')) return 'An account already exists with that email.';
    if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
    if (code.includes('invalid-email')) return 'That email address looks invalid.';
    return 'Something went wrong. Please try again.';
  }

  // ---- Auth state ----
  // This fires immediately on page load (with whatever the cached signed-in
  // user is, or null) and again every time sign-in/sign-out happens. It's
  // the single source of truth for "which screen should be visible."
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Signed in: show the app, hide the auth form, populate the user bar,
      // and start listening for this user's session + hand data.
      authScreen.style.display = 'none';
      appScreen.style.display = 'block';
      const name = user.displayName || user.email; // Google accounts have a display name; email accounts don't
      userBar.innerHTML = `<span>${name}</span><button id="signOutBtn">Sign out</button>`;
      document.getElementById('signOutBtn').addEventListener('click', () => signOut(auth));
      subscribeToSessions(user.uid);
      subscribeToHands(user.uid);
    } else {
      // Signed out: show the auth form, hide the app, and stop listening
      // for session/hand data (no point paying for reads nobody can see).
      authScreen.style.display = 'block';
      appScreen.style.display = 'none';
      userBar.innerHTML = '';
      if (unsubscribeSessions) { unsubscribeSessions(); unsubscribeSessions = null; }
      if (unsubscribeHands) { unsubscribeHands(); unsubscribeHands = null; }
    }
  });

  // ---- Add session ----
  // Validates the form, then writes one document to the "sessions"
  // collection in Firestore. Every doc is tagged with userId so Firestore's
  // security rules (and the query below) can scope data to its owner.
  addSessionBtn.addEventListener('click', async () => {
    addError.textContent = '';
    const user = auth.currentUser;
    if (!user) return; // shouldn't happen (button's only visible when signed in), just a safety check

    const buyIn = parseFloat(buyInInput.value);
    const cashOut = parseFloat(cashOutInput.value);
    const dateVal = dateInput.value;
    const location = locationInput.value.trim();

    if (!dateVal) { addError.textContent = 'Pick a date.'; return; }
    if (isNaN(buyIn) || isNaN(cashOut)) { addError.textContent = 'Enter numeric buy-in and cash-out.'; return; }

    const durationRaw = durationInput.value;
    const duration = durationRaw ? parseInt(durationRaw, 10) : null; // optional field

    try {
      addSessionBtn.disabled = true;                 // prevent double-submit while the write is in flight
      addSessionBtn.textContent = 'Adding…';
      await addDoc(collection(db, 'sessions'), {
        userId: user.uid,                            // ties this doc to the signed-in user
        date: dateVal,                                // stored as a plain "YYYY-MM-DD" string
        gameType: gameTypeInput.value,
        location: location || null,                   // empty string -> null, keeps the data tidy
        buyIn: buyIn,
        cashOut: cashOut,
        durationMinutes: duration,
        notes: notesInput.value.trim() || null,
        createdAt: serverTimestamp()                  // Firestore fills this in server-side
      });
      // Clear the form for the next entry (but leave game type as-is, and
      // reset the date back to today rather than blanking it)
      buyInInput.value = '';
      cashOutInput.value = '';
      durationInput.value = '';
      locationInput.value = '';
      notesInput.value = '';
      dateInput.valueAsDate = new Date();
      // No need to manually refresh the list/stats here — the onSnapshot
      // listener set up in subscribeToSessions() will pick up this new
      // document automatically and re-render.
    } catch (err) {
      addError.textContent = 'Could not save session. Try again.';
      console.error(err);
    } finally {
      addSessionBtn.disabled = false;
      addSessionBtn.textContent = 'Add session';
    }
  });

  // ---- Live session list + stats ----
  // Sets up a real-time Firestore listener scoped to one user's sessions,
  // newest first. Every time data changes (a session is added or deleted,
  // from this tab or any other device signed into the same account) this
  // callback re-runs and both the list and the stat cards refresh.
  //
  // Note: filtering by userId AND sorting by date at the same time requires
  // a Firestore composite index (userId asc, date desc) — that index was
  // created once in the Firebase console and doesn't need to be touched
  // again unless the query shape changes.
  function subscribeToSessions(uid) {
    if (unsubscribeSessions) unsubscribeSessions(); // drop any previous listener first (e.g. on user switch)
    const q = query(collection(db, 'sessions'), where('userId', '==', uid), orderBy('date', 'desc'));
    unsubscribeSessions = onSnapshot(q, (snap) => {
      const sessions = [];
      snap.forEach(d => sessions.push({ id: d.id, ...d.data() })); // doc.id isn't part of doc.data(), so add it in
      renderSessions(sessions);
      renderStats(sessions);
    }, (err) => {
      console.error(err);
    });
  }

  // Formats a number as "$12.34" or "-$5.00" (sign in front of the $, not behind it)
  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return `${sign}$${Math.abs(n).toFixed(2)}`;
  }

  // Recomputes the 4 top summary numbers from the full session list.
  // This runs client-side on every snapshot rather than being stored in
  // Firestore, so it's always consistent with whatever's currently loaded.
  function renderStats(sessions) {
    const count = sessions.length;
    const net = sessions.reduce((sum, s) => sum + (s.cashOut - s.buyIn), 0);
    const avg = count ? net / count : 0;
    const wins = sessions.filter(s => (s.cashOut - s.buyIn) > 0).length;
    const winRate = count ? Math.round((wins / count) * 100) : 0;

    statSessions.textContent = count;
    statNet.textContent = fmtMoney(net);
    statNet.className = 'val ' + (net > 0 ? 'win-val' : net < 0 ? 'loss-val' : ''); // green/red/neutral
    statAvg.textContent = fmtMoney(avg);
    statAvg.className = 'val ' + (avg > 0 ? 'win-val' : avg < 0 ? 'loss-val' : '');
    statWinRate.textContent = winRate + '%';
  }

  // Rebuilds the History list from scratch every time the data changes.
  // Simple to reason about at this scale (a handful of users, at most a
  // few hundred sessions each) — no need for more elaborate DOM diffing.
  function renderSessions(sessions) {
    if (!sessions.length) {
      sessionList.innerHTML = '<div class="empty-state">No sessions yet — log your first one above.</div>';
      return;
    }
    sessionList.innerHTML = ''; // clear previous render before re-adding all rows
    for (const s of sessions) {
      const net = s.cashOut - s.buyIn;
      const item = document.createElement('div');
      item.className = 'session-item';
      // "date" is stored as "YYYY-MM-DD"; appending T00:00:00 makes JS parse
      // it as local midnight instead of UTC midnight, avoiding an off-by-one-day
      // display bug for users west of UTC.
      const dateDisplay = new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const durText = s.durationMinutes ? ` · ${s.durationMinutes}m` : '';
      const locText = s.location ? ` · ${s.location}` : '';
      item.innerHTML = `
        <div class="meta">
          <div class="top">${s.gameType}${locText}</div>
          <div class="bottom">${dateDisplay}${durText}</div>
        </div>
        <div class="amt ${net > 0 ? 'win-val' : net < 0 ? 'loss-val' : ''}">${fmtMoney(net)}</div>
        <button class="del" title="Delete" data-id="${s.id}">✕</button>
      `;
      // Wire up this row's delete button. Done per-row (rather than one
      // listener on the whole list) since the whole list is rebuilt on
      // every render anyway.
      item.querySelector('.del').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        try {
          await deleteDoc(doc(db, 'sessions', id));
          // No manual re-render needed here either — deleting the doc
          // triggers the onSnapshot listener, which re-renders everything.
        } catch (err) {
          console.error(err);
        }
      });
      sessionList.appendChild(item);
    }
  }

  /* ============================================================
     HAND BREAKDOWN
     A self-contained poker hand replayer. State lives in a handful
     of plain JS variables (myHand, boardCards, opponentHand,
     handStreets); every mutation calls renderHandUI(), which
     rebuilds the dynamic parts of the DOM from that state — the
     same "rebuild from scratch on every change" approach used above
     for the session list, just applied to more pieces.

     Cards are { rank, suit } objects. rank is one of
     2-9, 'T','J','Q','K','A'; suit is one of Hearts/Diamonds/Clubs/Spades.
     ============================================================ */

  const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const RANK_VALUES = RANKS.reduce((map, rank, i) => ({ ...map, [rank]: i + 2 }), {});
  const SUIT_SYMBOLS = { Hearts: '♥', Diamonds: '♦', Spades: '♠', Clubs: '♣' };
  const RED_SUITS = new Set(['Hearts', 'Diamonds']);
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const STREET_LABELS = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };
  const AMOUNT_ACTIONS = new Set(['Bet', 'Raise', 'Call']);
  const HAND_RANK_ORDER = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
  ];

  function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
    return deck;
  }
  const FULL_DECK = buildDeck();

  function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function suitSymbol(suit) { return SUIT_SYMBOLS[suit] || '?'; }
  function cardKey(card) { return card ? `${card.rank}-${card.suit}` : ''; }
  function parseCardKey(key) { const [rank, suit] = key.split('-'); return { rank, suit }; }
  function emptyStreets() { return { preflop: [], flop: [], turn: [], river: [] }; }

  // Sorts ranks numerically (2-10, J=11, Q=12, K=13, A=14) — needed for straight checking.
  function getRankValues(cards) {
    return cards.map(card => RANK_VALUES[card.rank] || Number(card.rank) || 0);
  }
  function getRankCounts(cards) {
    const counts = {};
    cards.forEach(card => { counts[card.rank] = (counts[card.rank] || 0) + 1; });
    return counts;
  }
  function isFlush(cards) {
    const suitCounts = {};
    cards.forEach(card => { suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1; });
    return Object.values(suitCounts).some(count => count >= 5);
  }
  function isStraight(cards) {
    const values = [...new Set(getRankValues(cards))].sort((a, b) => a - b);
    if (values.includes(14)) values.unshift(1); // Ace can also play low (A-2-3-4-5)
    let run = 1;
    for (let i = 1; i < values.length; i++) {
      if (values[i] === values[i - 1] + 1) {
        run++;
        if (run >= 5) return true;
      } else if (values[i] !== values[i - 1]) {
        run = 1;
      }
    }
    return false;
  }
  function getStraightFlushRank(cards) {
    const bySuit = {};
    cards.forEach(card => {
      if (!bySuit[card.suit]) bySuit[card.suit] = [];
      bySuit[card.suit].push(card);
    });
    for (const group of Object.values(bySuit)) {
      if (group.length < 5 || !isStraight(group)) continue;
      const values = new Set(getRankValues(group));
      if ([10, 11, 12, 13, 14].every(v => values.has(v))) return 'Royal Flush';
      return 'Straight Flush';
    }
    return null;
  }
  // cards: all cards available to a player (hole cards + board). Returns the
  // name of the best 5-card hand ("Royal Flush", "Full House", etc.).
  function evaluatePokerHand(cards) {
    if (!cards || cards.length < 5) return 'Not enough cards';
    const straightFlush = getStraightFlushRank(cards);
    if (straightFlush) return straightFlush;
    const counts = Object.values(getRankCounts(cards)).sort((a, b) => b - a);
    if (counts[0] === 4) return 'Four of a Kind';
    if (counts[0] === 3 && counts[1] >= 2) return 'Full House';
    if (isFlush(cards)) return 'Flush';
    if (isStraight(cards)) return 'Straight';
    if (counts[0] === 3) return 'Three of a Kind';
    if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
    if (counts[0] === 2) return 'One Pair';
    return 'High Card';
  }
  // Compares two hand names by rank only (no kicker comparison).
  function compareHands(mine, theirs) {
    if (!mine || !theirs) return null;
    const diff = HAND_RANK_ORDER.indexOf(mine) - HAND_RANK_ORDER.indexOf(theirs);
    if (diff > 0) return 'you';
    if (diff < 0) return 'opponent';
    return 'tie';
  }
  function findFold(streets) {
    for (const street of STREETS) {
      const fold = streets[street].find(action => action.type === 'Fold');
      if (fold) return { street, player: fold.player };
    }
    return null;
  }
  function potFromStreets(streets) {
    return STREETS.reduce((sum, street) => {
      return sum + streets[street].reduce((streetSum, action) => streetSum + (action.amount || 0), 0);
    }, 0);
  }

  // ---- Hand Breakdown state ----
  let myHand = [null, null];
  let boardCards = [null, null, null, null, null];
  let opponentHand = [null, null];
  let handStreets = emptyStreets();
  let savedHands = []; // loaded live from Firestore, see subscribeToHands()

  function usedCardKeys() {
    const keys = new Set();
    ;[...myHand, ...boardCards, ...opponentHand].forEach(card => { if (card) keys.add(cardKey(card)); });
    return keys;
  }

  // Builds the <option> list for one card <select>, disabling any card
  // that's already placed elsewhere (except the one currently selected here).
  function buildCardOptionsHTML(currentKey, usedKeys) {
    let html = `<option value="">--</option>`;
    for (const card of FULL_DECK) {
      const key = cardKey(card);
      const disabled = usedKeys.has(key) && key !== currentKey ? 'disabled' : '';
      const selected = key === currentKey ? 'selected' : '';
      html += `<option value="${key}" ${disabled} ${selected}>${card.rank}${suitSymbol(card.suit)}</option>`;
    }
    return html;
  }

  // Renders one row of card slots (a <select> + the face card once chosen)
  // into containerEl, wiring each select's change handler to onChangeAt.
  function renderCardGroup(containerEl, cards, onChangeAt) {
    const usedKeys = usedCardKeys();
    containerEl.innerHTML = '';
    cards.forEach((card, i) => {
      const slot = document.createElement('div');
      slot.className = 'card-slot';
      const select = document.createElement('select');
      select.className = 'card-select';
      select.innerHTML = buildCardOptionsHTML(cardKey(card), usedKeys);
      select.addEventListener('change', (e) => {
        const val = e.target.value;
        onChangeAt(i, val ? parseCardKey(val) : null);
      });
      slot.appendChild(select);
      if (card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'poker-card ' + (RED_SUITS.has(card.suit) ? 'suit-red' : 'suit-black');
        cardEl.innerHTML = `${card.rank}<span class="suit">${suitSymbol(card.suit)}</span>`;
        slot.appendChild(cardEl);
      }
      containerEl.appendChild(slot);
    });
  }

  function updateMyHandAt(i, card) { myHand[i] = card; renderHandUI(); }
  function updateBoardAt(i, card) { boardCards[i] = card; renderHandUI(); }
  function updateOpponentHandAt(i, card) { opponentHand[i] = card; renderHandUI(); }

  function renderActionList(street) {
    const el = document.getElementById(`actions-${street}`);
    const actions = handStreets[street];
    if (!actions.length) {
      el.innerHTML = '<p class="empty-state">No action yet</p>';
      return;
    }
    el.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'action-list-items';
    actions.forEach((action, i) => {
      const li = document.createElement('li');
      li.className = 'action-row';
      const amountHTML = AMOUNT_ACTIONS.has(action.type) ? `<span class="action-amount">$${action.amount.toFixed(2)}</span>` : '';
      li.innerHTML = `
        <span class="action-player">${action.player === 'you' ? 'You' : 'Opponent'}</span>
        <span class="action-type">${action.type}</span>
        ${amountHTML}
        <button type="button" class="action-remove" data-street="${street}" data-index="${i}">×</button>
      `;
      ul.appendChild(li);
    });
    el.appendChild(ul);
    el.querySelectorAll('.action-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const s = e.currentTarget.getAttribute('data-street');
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        handStreets[s].splice(idx, 1);
        renderHandUI();
      });
    });
  }

  function addAction(street, action) {
    handStreets[street].push({ id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, ...action });
    renderHandUI();
  }

  // Wire up each street's "Add" button + amount-field show/hide, once, on load.
  STREETS.forEach(street => {
    const typeSelect = document.getElementById(`actionType-${street}`);
    const amountInput = document.getElementById(`actionAmount-${street}`);
    function syncAmountVisibility() {
      amountInput.style.display = AMOUNT_ACTIONS.has(typeSelect.value) ? '' : 'none';
    }
    typeSelect.addEventListener('change', syncAmountVisibility);
    syncAmountVisibility();

    document.querySelector(`.add-action-btn[data-street="${street}"]`).addEventListener('click', () => {
      const player = document.getElementById(`actionPlayer-${street}`).value;
      const type = typeSelect.value;
      const needsAmount = AMOUNT_ACTIONS.has(type);
      const amount = needsAmount ? (parseFloat(amountInput.value) || 0) : 0;
      addAction(street, { player, type, amount });
      amountInput.value = '';
    });
  });

  function handleRandomDeal() {
    const deck = shuffleDeck(buildDeck());
    myHand = deck.slice(0, 2);
    opponentHand = deck.slice(2, 4);
    boardCards = deck.slice(4, 9);
    renderHandUI();
  }
  function handleClearCards() {
    myHand = [null, null];
    boardCards = [null, null, null, null, null];
    opponentHand = [null, null];
    renderHandUI();
  }
  function handleResetAll() {
    handleClearCards();
    handStreets = emptyStreets();
    renderHandUI();
  }

  document.getElementById('randomDealBtn').addEventListener('click', handleRandomDeal);
  document.getElementById('clearCardsBtn').addEventListener('click', handleClearCards);
  document.getElementById('resetAllBtn').addEventListener('click', handleResetAll);
  document.getElementById('saveHandBtn').addEventListener('click', saveCurrentHand);

  // Works out the pot total and, once there's enough on the table to say
  // something, a plain-English outcome line (who folded / who won showdown).
  function computeOutcome() {
    const filledBoard = boardCards.filter(Boolean);
    const filledMyHand = myHand.filter(Boolean);
    const filledOpponentHand = opponentHand.filter(Boolean);

    const myResult = (filledMyHand.length === 2 && filledBoard.length >= 3)
      ? evaluatePokerHand([...filledMyHand, ...filledBoard]) : null;
    const opponentResult = (filledOpponentHand.length === 2 && filledBoard.length >= 3)
      ? evaluatePokerHand([...filledOpponentHand, ...filledBoard]) : null;

    const fold = findFold(handStreets);
    const pot = potFromStreets(handStreets);

    let outcome = null;
    if (fold) {
      const winner = fold.player === 'you' ? 'Opponent' : 'You';
      const folder = fold.player === 'you' ? 'You' : 'Opponent';
      outcome = `${winner} win${winner === 'You' ? '' : 's'} — ${folder} folded on the ${STREET_LABELS[fold.street]}.`;
    } else if (myResult && opponentResult) {
      const winner = compareHands(myResult, opponentResult);
      if (winner === 'tie') {
        outcome = `Split pot — both hold ${myResult} (kickers not compared).`;
      } else {
        const winnerLabel = winner === 'you' ? 'You win' : 'Opponent wins';
        const winnerHand = winner === 'you' ? myResult : opponentResult;
        const loserHand = winner === 'you' ? opponentResult : myResult;
        outcome = `${winnerLabel} — ${winnerHand} beats ${loserHand}.`;
      }
    } else if (myResult) {
      outcome = `Your hand: ${myResult}. Opponent cards unknown — no showdown comparison.`;
    }
    return { pot, outcome };
  }

  // Rebuilds every dynamic piece of the Hand Breakdown tab from current state.
  function renderHandUI() {
    renderCardGroup(document.getElementById('myHandGroup'), myHand, updateMyHandAt);
    renderCardGroup(document.getElementById('flopGroup'), boardCards.slice(0, 3), (i, c) => updateBoardAt(i, c));
    renderCardGroup(document.getElementById('turnGroup'), boardCards.slice(3, 4), (i, c) => updateBoardAt(3 + i, c));
    renderCardGroup(document.getElementById('riverGroup'), boardCards.slice(4, 5), (i, c) => updateBoardAt(4 + i, c));
    renderCardGroup(document.getElementById('opponentHandGroup'), opponentHand, updateOpponentHandAt);
    STREETS.forEach(renderActionList);

    const { pot, outcome } = computeOutcome();
    document.getElementById('potSummary').textContent = `Pot: ${fmtMoney(pot)}`;
    const resultEl = document.getElementById('handResult');
    if (outcome) {
      resultEl.textContent = outcome;
      resultEl.style.display = '';
    } else {
      resultEl.style.display = 'none';
    }
  }

  // ---- Save / load hands (Firestore, same per-user pattern as sessions) ----
  async function saveCurrentHand() {
    const user = auth.currentUser;
    if (!user) return;
    const { pot, outcome } = computeOutcome();
    const saveBtn = document.getElementById('saveHandBtn');
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      await addDoc(collection(db, 'hands'), {
        userId: user.uid,
        myHand,
        boardCards,
        opponentHand,
        streets: handStreets,
        pot,
        outcome: outcome || null,
        date: new Date().toISOString(),   // used for client-side sorting of the saved-hands list
        createdAt: serverTimestamp()
      });
      // No manual re-render needed — the onSnapshot listener in
      // subscribeToHands() below picks up the new doc automatically.
    } catch (err) {
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Hand';
    }
  }

  function loadHand(hand) {
    myHand = hand.myHand || [null, null];
    boardCards = hand.boardCards || [null, null, null, null, null];
    opponentHand = hand.opponentHand || [null, null];
    handStreets = hand.streets || emptyStreets();
    renderHandUI();
    switchTab('hand');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function staticCardsHTML(cards) {
    const filled = (cards || []).filter(Boolean);
    if (!filled.length) return '<span class="empty-state">—</span>';
    return filled
      .map(c => `<span class="mini-card ${RED_SUITS.has(c.suit) ? 'suit-red' : 'suit-black'}">${c.rank}${suitSymbol(c.suit)}</span>`)
      .join('');
  }

  // Rebuilds the "Saved Hands" list from scratch every time the data changes,
  // same approach as renderSessions() above.
  function renderSavedHands() {
    const el = document.getElementById('savedHandsList');
    if (!savedHands.length) {
      el.innerHTML = '<div class="empty-state">No saved hands yet.</div>';
      return;
    }
    el.innerHTML = '';
    for (const hand of savedHands) {
      const row = document.createElement('div');
      row.className = 'saved-hand-row';
      const dateDisplay = hand.date ? new Date(hand.date).toLocaleString() : '';
      row.innerHTML = `
        <div class="saved-hand-main">
          <div class="static-cards">${staticCardsHTML(hand.myHand)}</div>
          <span class="saved-hand-date">${dateDisplay}</span>
        </div>
        <div class="saved-hand-board static-cards">${staticCardsHTML(hand.boardCards)}</div>
        <div class="saved-hand-outcome">${hand.outcome || 'Hand in progress'}</div>
        <div class="saved-hand-pot">Pot: ${fmtMoney(hand.pot || 0)}</div>
        <div class="saved-hand-actions">
          <button type="button" class="load-hand-btn" data-id="${hand.id}">Load</button>
          <button type="button" class="del-hand-btn" data-id="${hand.id}">Delete</button>
        </div>
      `;
      el.appendChild(row);
    }
    el.querySelectorAll('.load-hand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const hand = savedHands.find(h => h.id === id);
        if (hand) loadHand(hand);
      });
    });
    el.querySelectorAll('.del-hand-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        try {
          await deleteDoc(doc(db, 'hands', id));
          // Deletion re-renders automatically via the onSnapshot listener below.
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // Live Firestore listener for this user's saved hands. Deliberately queries
  // by userId only (no orderBy) so it doesn't need its own composite index —
  // the small per-user result set is sorted client-side by date instead.
  function subscribeToHands(uid) {
    if (unsubscribeHands) unsubscribeHands();
    const q = query(collection(db, 'hands'), where('userId', '==', uid));
    unsubscribeHands = onSnapshot(q, (snap) => {
      savedHands = [];
      snap.forEach(d => savedHands.push({ id: d.id, ...d.data() }));
      savedHands.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      renderSavedHands();
    }, (err) => {
      console.error(err);
    });
  }

  // Initial paint of the Hand Breakdown tab (empty card selects, "No action
  // yet", $0.00 pot) so it looks right even before any sign-in/data arrives.
  renderHandUI();
