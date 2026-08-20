# gtracker — deploy instructions

This folder has everything needed to put gtracker live on Firebase Hosting.

## One-time setup (skip if already done)

```
npm install -g firebase-tools
```

## Deploy (2 commands)

From inside this folder:

```
firebase login
firebase deploy
```

`firebase login` opens a browser tab — sign in with the same Google account
you used to create the Firebase project (jordanpeleg@gmail.com), then click
Allow.

`firebase deploy` uploads `index.html` to Firebase Hosting. When it finishes
it prints a Hosting URL, something like:

```
https://gtracker-60774.web.app
```

That's your live app — open it, sign up (email/password or Google), and log
a session to confirm it saves.

## Re-deploying later

Whenever you edit `index.html`, just run `firebase deploy` again from this
folder to push the update live.

## What's already set up on the Firebase side

- Firestore database (production mode, rules already published — each user
  can only read/write their own sessions)
- Authentication: Email/Password and Google sign-in enabled
- A registered web app with the config already baked into `index.html`

You don't need to touch the Firebase console for any of this — it's already
live. This deploy step just publishes the actual web page.
