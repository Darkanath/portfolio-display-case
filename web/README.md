# web

The frontend SPA. React 19 + Vite + TypeScript + Tailwind. Deployed to Cloudflare Pages.

## Conventions

- TypeScript strict mode
- Tailwind for styling (no CSS-in-JS)
- API URLs come from Vite env vars (`VITE_EXPERIENCE_API`, `VITE_PERSONA_API`, `VITE_AGENT_API`)
- No client-side state library in v1; React state + URL state
- Dark mode default; light mode toggle available (persisted via localStorage)

## Design

- Body: Inter
- Display: Instrument Serif (italic for taglines)
- Mono: JetBrains Mono
- Accent: teal (Tailwind `accent-*`, mapped to `teal`)
- Motion is subtle: `animate-fade-up` for section reveals, `animate-pulse-soft` for loading states

## Run locally

```bash
npm install
npm run dev
```

The page expects all three APIs to be running. Use the root `docker compose up`
to start everything together.

## Testing

```bash
npm test
```

Uses Vitest. Tests live in `src/__tests__/`.

## Production build

```bash
npm run build
# Output in dist/, ready for Cloudflare Pages
```
