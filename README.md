# PulseSync AI

Emergency triage, ambulance dispatch and family alerts. Team Neurobot, Manthan 2026.
Plain HTML, CSS and JavaScript (ES modules). No build step.

## What is where

| File | Purpose |
| --- | --- |
| `index.html`, `css/landing.css`, `js/landing.js` | Landing page (team section lists Tanya Pandey) |
| `login.html`, `js/login.js`, `js/auth.js` | Sign in, create account, Google sign-in, password reset |
| `dashboard.html`, `js/app.js`, `css/app.css` | Dashboard shell, navigation, protected by sign-in |
| `js/pages-*.js` | Emergency, Health ID, Family & Meds, Care at Home, Community, Feedback |
| `js/alarm.js` | Alarm engine: loud looping tone, vibration, wake lock, full-screen alert, notification |
| `js/sos.js`, `js/triage.js` | SOS confirmation (reason + 5-second cancel), triage, call/WhatsApp/SMS family |
| `js/services.js` | Medicine alarms and family check-in timers |
| `js/chatbot.js`, `netlify/functions/chat.js` | AI assistant and its server function |
| `_redirects`, `netlify.toml`, `sw.js`, `manifest.webmanifest` | Netlify routing, service worker, installable app |

## 1. Turn on real sign-in (Firebase, free)

Until you do this, the login page runs in **demo mode**: accounts are kept in the visitor's own browser and are not secure. A banner on the login page says so.

1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. Copy its `firebaseConfig` values into the top of `js/auth.js`.
3. Authentication → Sign-in method: enable **Email/Password** and **Google**.
4. Authentication → Settings → Authorized domains: add your Netlify domain (for example `pulsesyncai.netlify.app`).

## 2. Turn on the AI chatbot

The chatbot calls `/api/chat`, which runs `netlify/functions/chat.js`. Without a key it still works using built-in first-aid and app answers.

In Netlify → Site configuration → Environment variables, add:

- `ANTHROPIC_API_KEY` (required, from https://console.anthropic.com)
- `ANTHROPIC_MODEL` (optional, default `claude-haiku-4-5-20251001`)
- `FIREBASE_API_KEY` (optional: if set, only signed-in users can chat)

The key stays on the server and is never sent to the browser.

## 3. Deploy

Netlify functions need either a Git deploy (connect this folder as a GitHub repo) or the CLI (`npx netlify deploy --prod`). Dragging the folder onto Netlify Drop publishes the website, but the chatbot may then stay in built-in-answer mode.

Feedback goes to **Netlify Forms** (Site → Forms) after the first deploy.

## Alarms and Do Not Disturb

The alarm engine rings as loud as the device allows, vibrates, keeps the screen awake and shows a full-screen alert. A website cannot switch off Do Not Disturb or the silent switch. For the best result, install the site to the home screen, allow it in the phone's Do Not Disturb exceptions and keep the alarm volume up. True bypass needs a native Android or iOS app. The Family & Meds page explains this in the settings help text.

Timers run while the page or installed app is open. A closed browser tab cannot ring.

## Honest limits of this prototype

- Ambulance dispatch, hospital beds and the ER pre-alert are **simulated sample data**. The screens say so. Call 108 for a real ambulance.
- Calls and messages open the phone's dialer, WhatsApp or SMS app with the text filled in. The person taps once to send.
- Fundraiser pledges open the donor's UPI app and pay the family directly. The two sample campaigns cannot take payments.
- Medical data is stored in the browser on this device only.
"# test" 
