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
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot,
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
  const tabGamesBtn = document.getElementById('tabGamesBtn');
  const sessionsTab = document.getElementById('sessionsTab');
  const handTab = document.getElementById('handTab');
  const gamesTab = document.getElementById('gamesTab');

  // Live Game tab elements
  const newGamePanel = document.getElementById('newGamePanel');
  const chipPresetBar = document.getElementById('chipPresetBar');
  const chipSetEditor = document.getElementById('chipSetEditor');
  const addDenominationBtn = document.getElementById('addDenominationBtn');
  const presetNameInput = document.getElementById('presetNameInput');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const startGameBtn = document.getElementById('startGameBtn');
  const startGameError = document.getElementById('startGameError');
  const activeGamePanel = document.getElementById('activeGamePanel');
  const gameTotalBuyIns = document.getElementById('gameTotalBuyIns');
  const gameTotalCashedOut = document.getElementById('gameTotalCashedOut');
  const gameOnTable = document.getElementById('gameOnTable');
  const chipsInPlay = document.getElementById('chipsInPlay');
  const playerList = document.getElementById('playerList');
  const newPlayerName = document.getElementById('newPlayerName');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const endGameBtn = document.getElementById('endGameBtn');
  const endGameWarning = document.getElementById('endGameWarning');
  const reconcilePanel = document.getElementById('reconcilePanel');
  const gameHistoryList = document.getElementById('gameHistoryList');

  // Chip counter dialog (shared by Buy-in, Rebuy and Cash Out)
  const chipDialog = document.getElementById('chipDialog');
  const chipDialogTitle = document.getElementById('chipDialogTitle');
  const chipDialogRows = document.getElementById('chipDialogRows');
  const chipDialogTotal = document.getElementById('chipDialogTotal');
  const chipDialogError = document.getElementById('chipDialogError');
  const chipDialogCancel = document.getElementById('chipDialogCancel');
  const chipDialogConfirm = document.getElementById('chipDialogConfirm');

  let isSignUpMode = false;        // false = "Sign in" form, true = "Create an account" form
  let unsubscribeSessions = null;  // holds the Firestore listener's cancel function (see below)
  let unsubscribeHands = null;     // same, for the Hand Breakdown "Saved Hands" listener
  let unsubscribeGames = null;     // same, for the Live Game tab's active/past games listener
  let unsubscribeChipPresets = null; // same, for the Live Game tab's saved chip-set presets

  // Default the date field to today so most users don't have to touch it
  dateInput.valueAsDate = new Date();

  // ---- Tab switching ----
  // Sessions, Hand Breakdown and Live Game are three independent panels
  // sharing one signed-in app screen; only one is visible at a time.
  function switchTab(tab) {
    sessionsTab.style.display = tab === 'sessions' ? 'block' : 'none';
    handTab.style.display = tab === 'hand' ? 'block' : 'none';
    gamesTab.style.display = tab === 'games' ? 'block' : 'none';
    tabSessionsBtn.classList.toggle('active', tab === 'sessions');
    tabHandBtn.classList.toggle('active', tab === 'hand');
    tabGamesBtn.classList.toggle('active', tab === 'games');
  }
  tabSessionsBtn.addEventListener('click', () => switchTab('sessions'));
  tabHandBtn.addEventListener('click', () => switchTab('hand'));
  tabGamesBtn.addEventListener('click', () => switchTab('games'));

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
      // and start listening for this user's session + hand + live-game data.
      authScreen.style.display = 'none';
      appScreen.style.display = 'block';
      const name = user.displayName || user.email; // Google accounts have a display name; email accounts don't
      userBar.innerHTML = `<span>${name}</span><button id="signOutBtn">Sign out</button>`;
      document.getElementById('signOutBtn').addEventListener('click', () => signOut(auth));
      subscribeToSessions(user.uid);
      subscribeToHands(user.uid);
      subscribeToGames(user.uid);
      subscribeToChipPresets(user.uid);
    } else {
      // Signed out: show the auth form, hide the app, and stop listening
      // for session/hand/game data (no point paying for reads nobody can see).
      authScreen.style.display = 'block';
      appScreen.style.display = 'none';
      userBar.innerHTML = '';
      if (unsubscribeSessions) { unsubscribeSessions(); unsubscribeSessions = null; }
      if (unsubscribeHands) { unsubscribeHands(); unsubscribeHands = null; }
      if (unsubscribeGames) { unsubscribeGames(); unsubscribeGames = null; }
      if (unsubscribeChipPresets) { unsubscribeChipPresets(); unsubscribeChipPresets = null; }
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

  // Pot odds: how good a price the player facing the most recent bet/raise
  // is getting on a call, expressed as "pot : call" and as the equity
  // (win %) needed for that call to break even.
  //
  // This is a simple log, not a strict turn-by-turn engine, so "the
  // decision on the table right now" is inferred as: the very last action
  // recorded across all streets (in street order). If that action is a Bet
  // or Raise, the *other* player is the one facing a call; a Check, Call,
  // or Fold means nothing is currently owed, so there's no odds to show.
  // `pot` is the running pot total (potFromStreets), which already
  // includes the outstanding bet — it does not yet include the call itself.
  function computePotOdds(streets, pot) {
    if (findFold(streets)) return null; // hand's already over, no decision pending

    let lastAction = null;
    for (const street of STREETS) {
      const actions = streets[street];
      if (actions.length) lastAction = actions[actions.length - 1];
    }
    if (!lastAction) return null;
    if (lastAction.type !== 'Bet' && lastAction.type !== 'Raise') return null;
    const callAmount = lastAction.amount || 0;
    if (callAmount <= 0) return null;

    const caller = lastAction.player === 'you' ? 'opponent' : 'you'; // whoever didn't make the bet owes the call
    const potAfterCall = pot + callAmount; // total pot once the call is made
    const equityNeeded = (callAmount / potAfterCall) * 100; // % equity required to break even on a call
    const ratio = pot / callAmount; // "pot-to-call" ratio, e.g. 3 means "3 to 1"

    return { caller, callAmount, pot, potAfterCall, equityNeeded, ratio };
  }

  // Shared text formatter used by both the live tool (renderHandUI) and the
  // Saved Hands list (renderSavedHands), so a saved hand's pot odds read
  // exactly the way they did at save time.
  function formatPotOddsText(potOdds) {
    const ratioDecimals = Number.isInteger(potOdds.ratio) ? 0 : 1;
    const ratioText = `${potOdds.ratio.toFixed(ratioDecimals)} : 1`;
    const whoText = potOdds.caller === 'you' ? 'You' : 'Opponent';
    return `Pot Odds — ${whoText} facing ${ratioText}: call ${fmtMoney(potOdds.callAmount)} to win `
      + `${fmtMoney(potOdds.potAfterCall)} (needs ${potOdds.equityNeeded.toFixed(1)}% equity to break even)`;
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
    const potOdds = computePotOdds(handStreets, pot);

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
    return { pot, outcome, potOdds };
  }

  // Rebuilds every dynamic piece of the Hand Breakdown tab from current state.
  function renderHandUI() {
    renderCardGroup(document.getElementById('myHandGroup'), myHand, updateMyHandAt);
    renderCardGroup(document.getElementById('flopGroup'), boardCards.slice(0, 3), (i, c) => updateBoardAt(i, c));
    renderCardGroup(document.getElementById('turnGroup'), boardCards.slice(3, 4), (i, c) => updateBoardAt(3 + i, c));
    renderCardGroup(document.getElementById('riverGroup'), boardCards.slice(4, 5), (i, c) => updateBoardAt(4 + i, c));
    renderCardGroup(document.getElementById('opponentHandGroup'), opponentHand, updateOpponentHandAt);
    STREETS.forEach(renderActionList);

    const { pot, outcome, potOdds } = computeOutcome();
    document.getElementById('potSummary').textContent = `Pot: ${fmtMoney(pot)}`;
    const potOddsEl = document.getElementById('potOdds');
    if (potOdds) {
      potOddsEl.textContent = formatPotOddsText(potOdds);
      potOddsEl.style.display = '';
    } else {
      potOddsEl.style.display = 'none';
    }
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
    const { pot, outcome, potOdds } = computeOutcome();
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
        potOdds: potOdds || null,         // snapshot of the pot odds at save time (see formatPotOddsText)
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
        ${hand.potOdds ? `<div class="saved-hand-pot-odds">${formatPotOddsText(hand.potOdds)}</div>` : ''}
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

  /* ============================================================
     LIVE GAME
     Tracks an in-person cash game by chip denomination rather than
     free-typed dollar amounts, so the end-of-night count can be
     checked two independent ways:
       1) Dollar check — total cash-outs should equal total buy-ins.
          If not, the *bookkeeping* has an error somewhere.
       2) Chip check — every chip bought in should come back out at
          cash-out. If the dollar check passes but chips are still
          unaccounted for (or vice versa), a chip is physically
          missing rather than a number being mistyped.

     Data model (Firestore):
       games/{gameId}: { userId, status: 'active'|'completed', chipSet,
         players: [{ id, name, active, transactions: [
           { type: 'buyin'|'rebuy'|'cashout', amount, chips: [{color,count}], at }
         ] }], createdAt, completedAt }
       chipPresets/{presetId}: { userId, name, chipSet, createdAt }
     Both collections follow the same per-user ownership pattern as
     `sessions` and `hands` — see claude/firebase-setup.md.

     One game doc holds the whole game (players + every transaction) and
     is updated with plain updateDoc() writes of the full `players` array;
     at this scale (a handful of players, a live listener already open)
     that's simpler than a transactions subcollection and still gives
     every device watching this game a real-time view via onSnapshot.
     ============================================================ */

  const DEFAULT_CHIP_SET = [
    { color: 'White', hex: '#f5f5f0', value: 1 },
    { color: 'Red', hex: '#d1453a', value: 5 },
    { color: 'Green', hex: '#3f9142', value: 25 },
    { color: 'Black', hex: '#2b2b2b', value: 100 },
  ];

  let activeGame = null;        // the one in-progress game doc ({id, ...data}), or null
  let completedGamesList = [];  // this user's finished games, newest first
  let chipPresetsList = [];     // this user's saved chip-set presets ({id, name, chipSet})
  let chipSetDraft = DEFAULT_CHIP_SET.map(d => ({ ...d })); // editable denominations for "Start a Live Game"

  // ---- Chip-set editor (used in the "Start a Live Game" panel) ----
  function renderChipSetEditor() {
    chipSetEditor.innerHTML = '';
    chipSetDraft.forEach((denom, i) => {
      const row = document.createElement('div');
      row.className = 'chip-set-row';
      row.innerHTML = `
        <input type="color" value="${denom.hex}" data-i="${i}" data-field="hex" title="Chip color" />
        <input type="text" value="${denom.color}" placeholder="Color name" data-i="${i}" data-field="color" />
        <input type="number" value="${denom.value}" min="0" step="0.01" placeholder="$ value" data-i="${i}" data-field="value" />
        <button type="button" class="remove-denom" data-i="${i}" title="Remove denomination">✕</button>
      `;
      chipSetEditor.appendChild(row);
    });
    chipSetEditor.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-i'), 10);
        const field = e.target.getAttribute('data-field');
        chipSetDraft[i][field] = field === 'value' ? (parseFloat(e.target.value) || 0) : e.target.value;
      });
    });
    chipSetEditor.querySelectorAll('.remove-denom').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-i'), 10);
        chipSetDraft.splice(i, 1);
        renderChipSetEditor();
      });
    });
  }
  addDenominationBtn.addEventListener('click', () => {
    chipSetDraft.push({ color: '', hex: '#888888', value: 0 });
    renderChipSetEditor();
  });
  renderChipSetEditor(); // initial paint, before any sign-in/data arrives

  // Strips blank rows and coerces types; used before both starting a game
  // and saving a preset, so both get the same validated shape.
  function cleanChipSet(draft) {
    return draft
      .map(d => ({ color: (d.color || '').trim(), hex: d.hex || '#888888', value: parseFloat(d.value) || 0 }))
      .filter(d => d.color && d.value > 0);
  }

  // ---- Saved chip-set presets ("if it's a game you play at often") ----
  // Stored in Firestore (not just localStorage) so a preset saved on one
  // device shows up on another, the same as sessions/hands.
  function subscribeToChipPresets(uid) {
    if (unsubscribeChipPresets) unsubscribeChipPresets();
    const q = query(collection(db, 'chipPresets'), where('userId', '==', uid));
    unsubscribeChipPresets = onSnapshot(q, (snap) => {
      chipPresetsList = [];
      snap.forEach(d => chipPresetsList.push({ id: d.id, ...d.data() }));
      chipPresetsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      renderChipPresetBar();
    }, (err) => console.error(err));
  }

  function renderChipPresetBar() {
    if (!chipPresetsList.length) {
      chipPresetBar.innerHTML = '';
      return;
    }
    chipPresetBar.innerHTML = '';
    chipPresetsList.forEach(preset => {
      const pill = document.createElement('span');
      pill.className = 'chip-preset-pill';
      pill.innerHTML = `<span class="preset-name">${preset.name}</span><button type="button" class="del-preset" data-id="${preset.id}" title="Delete this saved chip set">✕</button>`;
      pill.querySelector('.preset-name').addEventListener('click', () => {
        chipSetDraft = (preset.chipSet || []).map(d => ({ ...d }));
        if (!chipSetDraft.length) chipSetDraft = DEFAULT_CHIP_SET.map(d => ({ ...d }));
        renderChipSetEditor();
      });
      pill.querySelector('.del-preset').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await deleteDoc(doc(db, 'chipPresets', preset.id));
        } catch (err) { console.error(err); }
      });
      chipPresetBar.appendChild(pill);
    });
  }

  savePresetBtn.addEventListener('click', async () => {
    startGameError.textContent = '';
    const user = auth.currentUser;
    if (!user) return;
    const name = presetNameInput.value.trim();
    const cleanSet = cleanChipSet(chipSetDraft);
    if (!name) { startGameError.textContent = 'Name this chip set before saving it.'; return; }
    if (!cleanSet.length) { startGameError.textContent = 'Add at least one chip denomination with a name and a value greater than $0.'; return; }
    try {
      savePresetBtn.disabled = true;
      savePresetBtn.textContent = 'Saving…';
      await addDoc(collection(db, 'chipPresets'), {
        userId: user.uid,
        name,
        chipSet: cleanSet,
        createdAt: serverTimestamp(),
      });
      presetNameInput.value = '';
      // The new pill appears automatically via the onSnapshot listener above.
    } catch (err) {
      startGameError.textContent = 'Could not save chip set. Try again.';
      console.error(err);
    } finally {
      savePresetBtn.disabled = false;
      savePresetBtn.textContent = 'Save chip set';
    }
  });

  // ---- Start a new game ----
  startGameBtn.addEventListener('click', async () => {
    startGameError.textContent = '';
    const user = auth.currentUser;
    if (!user) return;
    const cleanSet = cleanChipSet(chipSetDraft);
    if (!cleanSet.length) {
      startGameError.textContent = 'Add at least one chip denomination with a name and a value greater than $0.';
      return;
    }
    try {
      startGameBtn.disabled = true;
      startGameBtn.textContent = 'Starting…';
      await addDoc(collection(db, 'games'), {
        userId: user.uid,
        status: 'active',
        chipSet: cleanSet,
        players: [],
        createdAt: serverTimestamp(),
        completedAt: null,
      });
      // subscribeToGames() below will see the new active game and switch panels automatically.
    } catch (err) {
      startGameError.textContent = 'Could not start game. Try again.';
      console.error(err);
    } finally {
      startGameBtn.disabled = false;
      startGameBtn.textContent = 'Start Game';
    }
  });

  // ---- Live listener: this user's active game + completed history ----
  // Deliberately queries by userId only (no orderBy), same reasoning as
  // subscribeToHands() above — avoids needing a composite index, and a
  // single user's game count is small enough to sort client-side.
  function subscribeToGames(uid) {
    if (unsubscribeGames) unsubscribeGames();
    const q = query(collection(db, 'games'), where('userId', '==', uid));
    unsubscribeGames = onSnapshot(q, (snap) => {
      const all = [];
      snap.forEach(d => all.push({ id: d.id, ...d.data() }));
      activeGame = all.find(g => g.status === 'active') || null;
      completedGamesList = all.filter(g => g.status === 'completed');
      completedGamesList.sort((a, b) => {
        const at = a.completedAt && a.completedAt.toMillis ? a.completedAt.toMillis() : 0;
        const bt = b.completedAt && b.completedAt.toMillis ? b.completedAt.toMillis() : 0;
        return bt - at;
      });
      renderGamesTab();
    }, (err) => console.error(err));
  }

  function renderGamesTab() {
    const hasActive = !!activeGame;
    newGamePanel.style.display = hasActive ? 'none' : 'block';
    activeGamePanel.style.display = hasActive ? 'block' : 'none';
    if (hasActive) {
      renderActiveGame(activeGame);
      reconcilePanel.style.display = 'none'; // hide any previous reconciliation once a new game is active
    }
    renderGameHistory(completedGamesList);
  }

  // ---- Totals (computed client-side from the raw transactions, same
  // "recompute on every render" approach as renderStats() above) ----
  function playerTotals(player) {
    let totalIn = 0, totalOut = 0;
    (player.transactions || []).forEach(t => {
      if (t.type === 'buyin' || t.type === 'rebuy') totalIn += t.amount;
      if (t.type === 'cashout') totalOut += t.amount;
    });
    return { totalIn, totalOut, net: totalOut - totalIn };
  }

  function gameTotals(game) {
    let totalBuyIns = 0, totalCashedOut = 0;
    (game.players || []).forEach(p => {
      const { totalIn, totalOut } = playerTotals(p);
      totalBuyIns += totalIn;
      totalCashedOut += totalOut;
    });
    return { totalBuyIns, totalCashedOut, onTable: totalBuyIns - totalCashedOut };
  }

  // Chips currently on the table, by color: every buy-in/rebuy chip adds,
  // every cash-out chip subtracts. Tracked independently of the dollar
  // totals above — this is the number that catches a physically missing
  // (or extra) chip even when the dollar math happens to balance.
  function chipsInPlayByColor(game) {
    const totals = {};
    (game.players || []).forEach(p => {
      (p.transactions || []).forEach(t => {
        const sign = t.type === 'cashout' ? -1 : 1;
        (t.chips || []).forEach(c => {
          totals[c.color] = (totals[c.color] || 0) + sign * c.count;
        });
      });
    });
    return totals;
  }

  function renderActiveGame(game) {
    const totals = gameTotals(game);
    gameTotalBuyIns.textContent = fmtMoney(totals.totalBuyIns);
    gameTotalCashedOut.textContent = fmtMoney(totals.totalCashedOut);
    gameOnTable.textContent = fmtMoney(totals.onTable);

    const byColor = chipsInPlayByColor(game);
    chipsInPlay.innerHTML = (game.chipSet || []).map(d => {
      const count = byColor[d.color] || 0;
      return `<span class="chip-pill"><span class="swatch" style="background:${d.hex}"></span>${count} × ${d.color} ($${d.value})</span>`;
    }).join('');

    playerList.innerHTML = '';
    if (!game.players.length) {
      playerList.innerHTML = '<div class="empty-state">No players yet — add one below.</div>';
    }
    game.players.forEach(p => {
      const { totalIn, net } = playerTotals(p);
      const cashedOut = p.active === false;
      const row = document.createElement('div');
      row.className = 'player-row' + (cashedOut ? ' cashed-out' : '');
      row.innerHTML = `
        <div class="player-meta">
          <div class="player-name">${p.name}</div>
          <div class="player-sub">Buy-in: ${fmtMoney(totalIn)}${cashedOut ? ' · Cashed out' : ''}</div>
        </div>
        <div class="player-net ${net > 0 ? 'win-val' : net < 0 ? 'loss-val' : ''}">${cashedOut ? fmtMoney(net) : '—'}</div>
        <div class="player-actions">
          ${cashedOut ? '' : `<button type="button" class="buyin-btn" data-id="${p.id}">${totalIn > 0 ? 'Rebuy' : 'Buy-in'}</button>`}
          ${cashedOut ? '' : `<button type="button" class="cashout-btn" data-id="${p.id}">Cash Out</button>`}
        </div>
      `;
      playerList.appendChild(row);
    });
    playerList.querySelectorAll('.buyin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openBuyInDialog(e.currentTarget.getAttribute('data-id')));
    });
    playerList.querySelectorAll('.cashout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openCashOutDialog(e.currentTarget.getAttribute('data-id')));
    });
  }

  addPlayerBtn.addEventListener('click', async () => {
    const name = newPlayerName.value.trim();
    if (!name || !activeGame) return;
    const newPlayer = { id: `p-${Date.now()}-${Math.round(Math.random() * 1e6)}`, name, active: true, transactions: [] };
    const updatedPlayers = [...activeGame.players, newPlayer];
    try {
      await updateDoc(doc(db, 'games', activeGame.id), { players: updatedPlayers });
      newPlayerName.value = '';
    } catch (err) {
      console.error(err);
    }
  });
  newPlayerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlayerBtn.click();
  });

  // ---- Shared chip-counting dialog (Buy-in, Rebuy, Cash Out) ----
  // A single <dialog>, repopulated on each open — see the three call sites
  // below rather than three near-identical dialogs.
  let chipDialogContext = null; // { minAmount, getResult, onConfirm } for whichever action is open

  function openChipDialog({ title, chipSet, confirmLabel, minAmount = 0, onConfirm }) {
    chipDialogTitle.textContent = title;
    chipDialogError.textContent = '';
    chipDialogConfirm.textContent = confirmLabel || 'Confirm';
    const counts = chipSet.map(() => 0);

    function renderRows() {
      chipDialogRows.innerHTML = '';
      let total = 0;
      chipSet.forEach((d, i) => {
        total += counts[i] * d.value;
        const row = document.createElement('div');
        row.className = 'chip-dialog-row';
        row.innerHTML = `
          <span class="swatch" style="background:${d.hex}"></span>
          <span class="denom-label">${d.color} ($${d.value})</span>
          <span class="stepper">
            <button type="button" class="step-down" data-i="${i}">−</button>
            <input type="number" min="0" step="1" value="${counts[i]}" data-i="${i}" />
            <button type="button" class="step-up" data-i="${i}">+</button>
          </span>
          <span class="row-subtotal">${fmtMoney(counts[i] * d.value)}</span>
        `;
        chipDialogRows.appendChild(row);
      });
      chipDialogTotal.textContent = fmtMoney(total);
      chipDialogRows.querySelectorAll('.step-down').forEach(b => b.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-i'), 10);
        counts[i] = Math.max(0, counts[i] - 1);
        renderRows();
      }));
      chipDialogRows.querySelectorAll('.step-up').forEach(b => b.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-i'), 10);
        counts[i] = counts[i] + 1;
        renderRows();
      }));
      chipDialogRows.querySelectorAll('input[type="number"]').forEach(inp => inp.addEventListener('input', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-i'), 10);
        counts[i] = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);
        renderRows();
      }));
    }
    renderRows();

    chipDialogContext = {
      minAmount,
      getResult: () => {
        const total = chipSet.reduce((sum, d, i) => sum + counts[i] * d.value, 0);
        const chips = chipSet.map((d, i) => ({ color: d.color, count: counts[i] })).filter(c => c.count > 0);
        return { chips, amount: total };
      },
      onConfirm,
    };
    chipDialog.showModal();
  }

  chipDialogCancel.addEventListener('click', () => {
    chipDialogError.textContent = '';
    chipDialog.close();
  });
  chipDialogConfirm.addEventListener('click', async () => {
    if (!chipDialogContext) { chipDialog.close(); return; }
    const result = chipDialogContext.getResult();
    if (result.amount < chipDialogContext.minAmount) {
      chipDialogError.textContent = `Enter at least ${fmtMoney(chipDialogContext.minAmount)} in chips.`;
      return;
    }
    chipDialogError.textContent = '';
    await chipDialogContext.onConfirm(result);
    chipDialog.close();
  });

  function openBuyInDialog(playerId) {
    if (!activeGame) return;
    const player = activeGame.players.find(p => p.id === playerId);
    if (!player) return;
    const isFirst = !(player.transactions || []).some(t => t.type === 'buyin' || t.type === 'rebuy');
    openChipDialog({
      title: `${isFirst ? 'Buy-in' : 'Rebuy'} — ${player.name}`,
      chipSet: activeGame.chipSet,
      confirmLabel: isFirst ? 'Confirm Buy-in' : 'Confirm Rebuy',
      minAmount: 0.01, // a buy-in of $0 doesn't mean anything — require at least one chip
      onConfirm: async ({ chips, amount }) => {
        const tx = { type: isFirst ? 'buyin' : 'rebuy', amount, chips, at: new Date().toISOString() };
        const updatedPlayers = activeGame.players.map(p => p.id === playerId
          ? { ...p, transactions: [...(p.transactions || []), tx] }
          : p);
        try {
          await updateDoc(doc(db, 'games', activeGame.id), { players: updatedPlayers });
        } catch (err) { console.error(err); }
      },
    });
  }

  function openCashOutDialog(playerId) {
    if (!activeGame) return;
    const player = activeGame.players.find(p => p.id === playerId);
    if (!player) return;
    openChipDialog({
      title: `Cash Out — ${player.name}`,
      chipSet: activeGame.chipSet,
      confirmLabel: 'Confirm Cash-out',
      minAmount: 0, // $0 is valid — a player who busted out has nothing to cash
      onConfirm: async ({ chips, amount }) => {
        const tx = { type: 'cashout', amount, chips, at: new Date().toISOString() };
        const updatedPlayers = activeGame.players.map(p => p.id === playerId
          ? { ...p, active: false, transactions: [...(p.transactions || []), tx] }
          : p);
        try {
          await updateDoc(doc(db, 'games', activeGame.id), { players: updatedPlayers });
        } catch (err) { console.error(err); }
      },
    });
  }

  // ---- End game + reconciliation ----
  endGameBtn.addEventListener('click', async () => {
    endGameWarning.textContent = '';
    if (!activeGame) return;
    const stillIn = activeGame.players.filter(p => p.active !== false);
    if (stillIn.length) {
      endGameWarning.textContent = `${stillIn.length} player(s) haven't cashed out yet: ${stillIn.map(p => p.name).join(', ')}. Cash everyone out before ending the game.`;
      return;
    }
    try {
      endGameBtn.disabled = true;
      await updateDoc(doc(db, 'games', activeGame.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      // Show the reconciliation immediately using what we just wrote, rather
      // than waiting on the round-trip snapshot update.
      renderReconciliation({ ...activeGame, status: 'completed' });
    } catch (err) {
      endGameWarning.textContent = 'Could not end game. Try again.';
      console.error(err);
    } finally {
      endGameBtn.disabled = false;
    }
  });

  // Minimal-transfer settle-up: nets every player's buy-ins vs. cash-out,
  // then greedily matches the biggest debtor against the biggest creditor
  // until everyone's at $0 — fewer Venmo transfers than "everyone pays the
  // house, the house pays everyone."
  function settleUp(players) {
    const nets = (players || []).map(p => ({ name: p.name, net: playerTotals(p).net }));
    const creditors = nets.filter(p => p.net > 0.005).map(p => ({ ...p })).sort((a, b) => b.net - a.net);
    const debtors = nets.filter(p => p.net < -0.005).map(p => ({ name: p.name, net: -p.net })).sort((a, b) => b.net - a.net);
    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amount = Math.min(creditors[ci].net, debtors[di].net);
      transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount });
      creditors[ci].net -= amount;
      debtors[di].net -= amount;
      if (creditors[ci].net < 0.005) ci++;
      if (debtors[di].net < 0.005) di++;
    }
    return transfers;
  }

  // Renders the dollar check, the chip check, and a settle-up list for one
  // game — used both right after ending the active game and when a past
  // game is clicked in the history list below.
  function renderReconciliation(game) {
    const totals = gameTotals(game);
    const diff = totals.totalBuyIns - totals.totalCashedOut;
    const balanced = Math.abs(diff) < 0.005;

    const chipDiff = chipsInPlayByColor(game); // should be 0 for every color once everyone's cashed out
    const chipDiffEntries = Object.entries(chipDiff).filter(([, v]) => v !== 0);

    const settle = settleUp(game.players);

    reconcilePanel.style.display = 'block';
    reconcilePanel.innerHTML = `
      <h2>Reconciliation</h2>
      <div class="reconcile-status ${balanced ? 'balanced' : 'off'}">
        ${balanced
          ? '✓ Balanced — every dollar is accounted for.'
          : `⚠ Off by ${fmtMoney(Math.abs(diff))} — ${diff > 0 ? 'less was cashed out than bought in' : 'more was cashed out than bought in'}. Recount the chips.`}
      </div>
      <div class="reconcile-grid">
        <div class="stat-card"><div class="val">${fmtMoney(totals.totalBuyIns)}</div><div class="lbl">Total Buy-ins</div></div>
        <div class="stat-card"><div class="val">${fmtMoney(totals.totalCashedOut)}</div><div class="lbl">Total Cash-outs</div></div>
        <div class="stat-card"><div class="val ${balanced ? '' : 'loss-val'}">${fmtMoney(diff)}</div><div class="lbl">Difference</div></div>
      </div>
      ${chipDiffEntries.length ? `
        <div class="reconcile-section-label">Chip count check — chips still unaccounted for</div>
        <div class="chips-in-play">${chipDiffEntries.map(([color, v]) => `<span class="chip-pill">${color}: ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
      ` : ''}
      <div class="reconcile-section-label">Settle Up</div>
      <div class="settle-list">
        ${settle.length ? settle.map(s => `<div class="settle-row"><span>${s.from} → ${s.to}</span><span>${fmtMoney(s.amount)}</span></div>`).join('') : '<div class="empty-state">Nothing to settle.</div>'}
      </div>
    `;
  }

  function renderGameHistory(games) {
    if (!games.length) {
      gameHistoryList.innerHTML = '<div class="empty-state">No completed games yet.</div>';
      return;
    }
    gameHistoryList.innerHTML = '';
    games.forEach(g => {
      const totals = gameTotals(g);
      const dateDisplay = (g.completedAt && g.completedAt.toDate)
        ? g.completedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const diff = totals.totalBuyIns - totals.totalCashedOut;
      const balanced = Math.abs(diff) < 0.005;
      const row = document.createElement('div');
      row.className = 'game-history-row';
      row.innerHTML = `
        <div class="meta">
          <div class="top">${(g.players || []).length} players · ${fmtMoney(totals.totalBuyIns)} on the table</div>
          <div class="bottom">${dateDisplay}${balanced ? ' · Balanced' : ` · Off by ${fmtMoney(Math.abs(diff))}`}</div>
        </div>
        <span class="${balanced ? 'win-val' : 'loss-val'}">${balanced ? '✓' : '⚠'}</span>
      `;
      row.addEventListener('click', () => {
        renderReconciliation(g);
        reconcilePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      gameHistoryList.appendChild(row);
    });
  }

  // ---- PWA: service worker registration ----
  // Caches the static app shell (HTML/CSS/JS/icons) so the app opens
  // instantly and mostly works offline. Firestore/Auth calls are untouched —
  // see sw.js for exactly what gets cached.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
