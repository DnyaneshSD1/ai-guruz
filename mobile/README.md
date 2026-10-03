# AI Guruz — Mobile

One codebase for iOS and Android. Expo SDK 57, React Native, TypeScript, Expo Router. It uses the same backend API
as the web app and offers the same features, laid out for a phone.

## Layout

```
mobile/src/
├── app/                               every file is a screen (Expo Router)
│   ├── _layout.tsx                    providers + navigation stack
│   ├── index.tsx                      waits for the stored session, then routes to the app or sign-in
│   ├── login.tsx  register.tsx
│   ├── (tabs)/                        Home · Learn · Documents · Insights · More
│   ├── curriculum/[id].tsx            a learning path
│   ├── module/[curriculumId]/[moduleId].tsx   lesson + quiz
│   ├── document/[id].tsx              summary, mind map, deep analysis, exam prep
│   ├── knowledge.tsx                  knowledge graph (as a path of modules with concept mastery)
│   └── admin/users.tsx  admin/audit.tsx       administrators only
├── components/                        ui.tsx (design system, useLoad), Quiz.tsx, AuthScreen.tsx
└── lib/
    ├── api.ts                         fetch wrapper: bearer token, silent refresh, secure token storage
    ├── providers.tsx                  session and theme (light / dark / system)
    └── types.ts                       API response types (same as web)
```

## How it works

- **Session.** The app sends `X-Client: mobile`, so the backend returns the refresh token in the response body
  instead of a cookie. It is stored in the iOS Keychain / Android Keystore through `expo-secure-store`; the access
  token is kept in memory. Refresh tokens are single-use and rotated on every refresh.
- **Authorization.** Tabs and buttons follow the user's role; the backend enforces every rule.
- **Theme.** Light, dark or system (More → Appearance), using the same colour tokens as the web app.

## Run locally

Prerequisites: Node 20+, the backend running (see `backend/README.md`), and one of: the Expo Go app on a phone,
Android Studio (emulator), or Xcode on a Mac (iOS simulator).

```bash
npm install
npx expo start          # then press a (Android), i (iOS), or scan the QR code with Expo Go
```

Which backend address the app uses:

| Where the app runs | Address | What to do |
|---|---|---|
| iOS simulator | `http://localhost:8080` | nothing (default) |
| Android emulator | `http://10.0.2.2:8080` | nothing (default) |
| Physical phone | `http://<your computer's LAN IP>:8080` | copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL`, restart Expo; phone and computer on the same Wi-Fi; allow port 8080 through the firewall |

Metro (the Expo bundler) uses port 8081, which is why the backend services use 8101–8107.

Checks:

```bash
npx tsc --noEmit        # typecheck
npx expo-doctor         # dependency and config check
```

## Production builds

Use EAS Build (`npm i -g eas-cli`, `eas build:configure`, `eas build --platform all`). Before building:

- set `EXPO_PUBLIC_API_URL` to the HTTPS address of the API (release builds on both platforms block plain HTTP);
- the icons and splash image in `assets/images/` are generated from the AI Guruz logo; replace them if the artwork changes;
- confirm the identifiers in `app.json` (`com.aiguruz.app`).

## Status

The app type-checks and bundles for both iOS and Android. It has not yet been run on a device or emulator in this
workspace, so do a pass through each screen before release. One difference from the web app: downloading the
original uploaded file is not available on mobile.
