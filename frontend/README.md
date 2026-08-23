# VoyaGen AI · Frontend

Vite + React 18 + TypeScript + Tailwind CSS + Framer Motion.
This is the maintained UI; `../templates/` and `../static/` are the legacy vanilla version.

## Develop

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Run the FastAPI service in another terminal (`python app.py` from the project root).
Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`, so there is no CORS setup.
Override the target with `VITE_API_TARGET` if the API runs elsewhere.

## Build

```bash
npm run build        # tsc --build && vite build → dist/
npm run typecheck    # types only
npm run preview      # serve the production build
```

To serve the build from FastAPI, mount `frontend/dist` last in `app.py` — see the
"Running the Application" section of the root README.

## Layout

```
src/
├── App.tsx            phase orchestration, scroll focus, health probe
├── index.css          design tokens, glass/button layers, markdown styles
├── components/        UI sections (one file each)
├── hooks/
│   ├── useTravelPlanner.ts   phase machine + thread persistence
│   └── useTheme.ts           dark/light
└── lib/
    ├── api.ts         typed fetch client
    ├── types.ts       mirrors backend._serialize_result() — keep in sync
    ├── agents.ts      per-agent label, icon, colour
    └── utils.ts
```

## Conventions

- Colours come from CSS custom properties on `:root` / `html.light`, never hardcoded hex.
  Use `rgb(var(--accent) / 0.14)` so any token works at any opacity.
- `src/lib/types.ts` mirrors the backend response exactly. Update both together.
- Run `npm run typecheck` before committing.
