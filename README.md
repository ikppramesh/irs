# 🚆 IRS: Indian Rail Search

One place for everything about Indian trains, with **official IRCTC fares and ₹0 commission**. Powered by [RailKit](https://railkit.in/).

## Features

| Tab | What you get |
|---|---|
| 🗺️ Plan Journey | Trains between any two stations, with departure/arrival, travel time, **distance (km)**, halts and running days. Tap a class for the **official fare breakdown** and **6-day seat availability with confirmation chance**. |
| 🚂 Train Route | Full route and timetable, total distance, platform numbers, map links, and a **distance + time calculator between any two stops**. |
| 📍 Live Track | Live running status with a moving-train progress bar, delays at every station, coach position and optional auto-refresh. |
| 🕓 Run History | Station-wise actual vs scheduled times for completed runs, plus a **last-5-days punctuality report**. |
| 🎫 PNR Status | Booking and current status per passenger, chart status and fare. |
| 🏛️ Station | Live LED arrivals/departures board (2/4/8 hrs), amenities, and the full station timetable. |
| ⛔ Cancelled | Today's fully and partially cancelled trains, filterable. |
| 🔗 IRCTC Services | Direct links to official booking, cancellation/TDR, e-catering, retiring rooms, UTS, NTES and Rail Madad. |

### Zero commission

IRS shows the exact IRCTC fare and adds nothing. **Book on IRCTC** copies your trip details (train, stations, date, class) to the clipboard and opens the official IRCTC booking page, so no agent fee is involved. IRCTC's own small convenience fee (≈₹15 non-AC / ₹30 AC + GST) still applies at payment. Ticket purchase itself has to happen on IRCTC; RailKit is a read-only data API.

## Run locally

```bash
npm install
cp .env.example .env   # then put your RailKit API key in .env
npm start              # http://localhost:3000
```

Use `npm run dev` to auto-restart on changes.

## How it's built

- `server.js`: Express server. It keeps the RailKit API key on the server, validates input and caches responses briefly. It exposes `/api/*` routes.
- `public/`: dependency-free HTML/CSS/JS front end. It is mobile responsive, has light/dark mode, and shows a train-running loader.

> Never commit `.env`. It's already in `.gitignore`.
