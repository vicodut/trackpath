# AT Tracker

Web app to track a thru-hike on the Appalachian Trail using a Garmin inReach Mini 2.

## Features

- Interactive map with the Appalachian Trail route
- Garmin inReach Mini 2 integration via MapShare KML feed
- Auto-polling for new GPS points (configurable interval)
- Manual point entry for contributors (form + click-on-map)
- Tracking point history with distance stats
- PostgreSQL storage via Drizzle ORM

## Prerequisites

- Node.js 18+
- PostgreSQL with a database created (e.g. `path_tracker`)

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgres://username:password@localhost:5432/path_tracker
MAPSHARE_ID=YourShareName
POLL_INTERVAL_MIN=5
PORT=3000
```

- `DATABASE_URL` — PostgreSQL connection string (required)
- `MAPSHARE_ID` — your Garmin MapShare ID (optional, enables inReach sync)
- `POLL_INTERVAL_MIN` — auto-sync interval in minutes (default: 5)
- `PORT` — server port (default: 3000)

### Finding your MapShare ID

1. Sign in at [explore.garmin.com](https://explore.garmin.com)
2. Go to **Social** > enable **MapShare**
3. Your MapShare URL is `share.garmin.com/YourShareName` — the last part is your `MAPSHARE_ID`

4. **Start the app**

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

For development with auto-reload:

```bash
npm run dev
```

## Drizzle commands

```bash
npm run db:generate   # Generate migrations from schema changes
npm run db:migrate    # Apply migrations
npm run db:studio     # Open Drizzle Studio to browse data
```

## API

| Method   | Endpoint           | Description                 |
| -------- | ------------------ | --------------------------- |
| `GET`    | `/api/points`      | Get all tracking points     |
| `POST`   | `/api/points`      | Add a point manually        |
| `DELETE` | `/api/points/:id`  | Delete a point              |
| `POST`   | `/api/sync`        | Trigger a Garmin sync       |
| `GET`    | `/api/sync-status` | Last sync status and config |

### Add a point manually

```bash
curl -X POST http://localhost:3000/api/points \
  -H "Content-Type: application/json" \
  -d '{"latitude": 34.627, "longitude": -84.194, "altitude": 1152, "message": "Springer Mountain!"}'
```
