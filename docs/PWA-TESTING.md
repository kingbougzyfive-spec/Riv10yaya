# PWA test checklist

Run after deployment (HTTPS is required; service workers and installation do not work on plain http except localhost). Tick each line on a real device. **Nothing here has been run yet.**

## Install
- [ ] Android Chrome: the "Install now" button appears on `/install`, or ⋮ → Install app. Icon appears; the app opens full screen without the address bar.
- [ ] Samsung Internet: menu → Add page to → Home screen.
- [ ] iPhone Safari (iOS 16.4+): Share → Add to Home Screen. Icon, name, launch screen shown while opening, status bar translucent, opens standalone.
- [ ] iPad Safari: same, in portrait and landscape; launch screen matches orientation.
- [ ] Windows/macOS/ChromeOS Chrome or Edge: install icon in the address bar; opens in its own window.
- [ ] Firefox desktop: confirm the page says it cannot install and the site still works normally.
- [ ] `/install` highlights the card for the device in use and shows "installed" once installed.

## Offline (turn on airplane mode after loading pages online first)
- [ ] Home, events, announcements, departments, zones, leadership, gallery, contact can be opened; the offline banner shows.
- [ ] A page never opened before shows the "You're offline" page, not an error.
- [ ] `/admin`, `/me` and `/login` do NOT open from cache offline.
- [ ] Offline, try to submit a finance remittance, a report, a payment decision and a member edit: each must refuse with "You're offline… Nothing was sent", the buttons are dimmed, and nothing appears as submitted or confirmed after reconnecting unless you submit again.
- [ ] Offline, mark notifications read: shows "not sent yet", then sends once online.
- [ ] Sign out, then go offline: no previously opened private page is available.

## Updates
- [ ] Deploy a new version; reopen the app: the "A new version is ready" bar appears; "Update" reloads onto the new version; "Later" keeps working.

## Push
- [ ] Android/desktop: Turn on notifications, send a test from Communications, tap the notification, it opens the linked page.
- [ ] iPhone/iPad: in Safari the toggle shows the "add to Home Screen first" guidance; after installing, open from the icon, Turn on notifications, send a test.
- [ ] Note which devices do not deliver while the app is closed; capabilities differ by operating system.

## Tools
- Lighthouse (Chrome DevTools → Lighthouse → Progressive Web App) and Application → Manifest / Service Workers.
- `node scripts/check-pwa.mjs` and `node tests/sw.test.mjs`.
