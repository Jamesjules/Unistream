# UniStream Firebase Functions - Deploy Instructions

## Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Logged in: `firebase login`
- A Firebase project created.

## 1) Set up project
- `firebase init functions` (choose TypeScript)
- Replace the generated `functions/` with this folder.

## 2) Configure functions environment secrets (never in frontend)
- Set your Telegram bot token:
  firebase functions:config:set unistream.telegram_bot_token="YOUR_TELEGRAM_BOT_TOKEN"

- (Optional) Provide a service account JSON for Google Drive as base64:
  export SA_B64=$(base64 service-account.json | tr -d '\n')
  firebase functions:config:set unistream.drive_service_account_b64="$SA_B64"

- (Optional) set latest app version for update check:
  firebase functions:config:set unistream.latest_version="1.0.0"

## 3) Install & build
- `cd functions`
- `npm install`
- `npm run build` (tsc)

## 4) Emulate locally (optional)
- `firebase emulators:start --only functions`

## 5) Deploy
- `firebase deploy --only functions`

After deploy, your functions endpoint will be at:
https://us-central1-YOUR_PROJECT.cloudfunctions.net/api
(Replace region and project as returned by Firebase)

Example endpoints:
- POST https://<region>-<project>.cloudfunctions.net/api/telegram/verify-login
- GET  https://<region>-<project>.cloudfunctions.net/api/telegram/channel/Gmedia/latest?limit=20
- GET  https://<region>-<project>.cloudfunctions.net/api/drive/folder/<folderId>/files
- GET  https://<region>-<project>.cloudfunctions.net/api/update/latest
