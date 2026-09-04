# gtracker

A small, single-page web app for tracking poker and gambling sessions — built for a private group of a few friends, no accounts beyond sign-in required.

**Live app:** https://gtracker-60774.web.app

## What it does

**Sessions** — sign in (email/password or Google), log a session (date, game type, location, buy-in, cash-out, duration, notes), and see a live-updating history plus stats: session count, net, average per session, and win rate.

**Hand Breakdown** — a poker hand replayer and study tool:
- Pick your hole cards, the board (flop/turn/river), and optionally an opponent's hole cards from card selects.
- Log betting actions (Bet / Raise / Call / Check / Fold) per street for either player; the pot total updates live from logged amounts.
- **Pot odds** are computed automatically whenever there's an unmatched bet or raise to act on — e.g. "facing 3 : 1: call \$50.00 to win \$200.00 (needs 25.0% equity to break even)."
- A built-in hand evaluator (pair through royal flush) shows your best hand and, once opponent cards are filled in, a plain-English outcome.
- "Random Deal" deals a full random hand for practice; hands can be saved and reloaded later.

## Tech stack

Plain HTML/CSS/JavaScript — no framework, no bundler, no build step. `app.js` is loaded as an ES module and imports the Firebase SDK straight from Google's CDN, so the app runs as-is from a static file host.

- **Firebase Authentication** — Email/Password and Google sign-in
- **Cloud Firestore** — stores `sessions` and `hands`, each document scoped to its owner (`userId == request.auth.uid`), enforced by Firestore security rules
- **Firebase Hosting** — serves the static site

## Project structure

```
gTracker/
└── gtracker/              the actual app — this is the deploy root
    ├── index.html
    ├── app.js
    ├── styles.css
    ├── firebase.json
    └── .firebaserc
