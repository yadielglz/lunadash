# LunaDash

LunaDash is a realtime store dashboard built with React, TypeScript, Vite, Zustand, Tailwind CSS, and Supabase. It combines daily operations, team scheduling, goals, announcements, weather, device lookup, and display-mode slides into one shared workspace.

## Features

- Customizable home dashboard with draggable/resizable widgets
- Daily checklist with categories, completion tracking, editing, and reorder controls
- Weekly and monthly scheduling with employee management
- Shift copy and reusable local schedule templates
- Goal tracking with daily logs, monthly targets, milestones, and progress rings
- Store announcements for dashboard and display mode
- Weather and time display preferences
- Store-scoped Supabase data sync with realtime updates
- PIN-protected devices area
- Presentation-friendly display mode

## Tech Stack

- React 18 + TypeScript
- Vite
- Zustand
- Supabase
- Tailwind CSS
- Framer Motion
- date-fns
- lucide-react
- react-grid-layout

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run linting:

```bash
npm run lint
```

## Supabase Setup

The app expects the tables defined in `schema.sql`. Run that file in the Supabase SQL editor for a fresh project.

The current Supabase client is configured in `src/lib/supabase.ts` with a publishable key. If you move the app to a different Supabase project, update that file or refactor the values into Vite environment variables.

Data is scoped by the Store Data ID saved in Settings. Every device that should share one store workspace must use the same Store Data ID.

## Deployment

The project includes `netlify.toml` and `public/_redirects` for Netlify SPA routing. A normal Netlify build can use:

```bash
npm run build
```

with `dist` as the publish directory.

## Notes

- Schedule templates are stored locally in the browser under `luna-schedule-templates`.
- Widget layouts are stored locally in the browser under `luna-widget-layouts`.
- Supabase handles shared schedules, goals, tasks, announcements, and display settings.
