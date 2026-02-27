# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elementary school specialist teacher timetable scheduler (전담 시간표 편성). A Korean-language React SPA that automates scheduling of specialist subjects (체육, 영어, 과학, 음악, etc.) across grades, classes, and special rooms with conflict detection.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run lint` — ESLint check (flat config, JS/JSX only)
- `npm run preview` — Preview production build

## Tech Stack

- **React 19** with JSX (no TypeScript)
- **Vite 7** with `@vitejs/plugin-react`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (CSS-first config in `index.css` with `@import "tailwindcss"`)
- **lucide-react** for icons
- **uuid** for entity IDs
- **xlsx** (SheetJS) for Excel export

## Architecture

### State Management

All state lives in `App.jsx` via `useState` hooks and is passed down as props. No external state library. Key state:
- `grades` — Array of grade objects with UUID `id`, `name`, `classCount`, `dailyMaxHours[5]`
- `subjects` — Array of subjects, each linked to a `gradeId` with nested `modules[]` (location, weeklyHours, hasBlock, etc.)
- `specialRooms` — Array of room objects with `name` and `capacity` (concurrent class limit)
- `assignments` — Flat array of scheduled slots (the timetable output)
- `teachers` — Array of teacher objects linked to subjects/grades/classes

### Scheduling Engine (`src/utils/scheduler.js`)

Core algorithm — a **fail-safe linear solver** with greedy heuristic scoring:

1. **`decomposeModules()`** — Breaks subjects into scheduling units (blocks of 2 or singles, supports 0.5-hour half-periods)
2. **`generateRoundRobinQueue()`** — Interleaves units by grade-class for fairness
3. **`runAutoScheduler()`** — Iterates queue, finds best slot via `findBestSlot()` using scoring heuristics (morning priority, distribution bonus, room clustering, classroom penalty)
4. **`validateAssignments()`** — Post-hoc conflict detection across 6 conflict types: class overlap, room overlap, teacher overlap, room capacity exceeded, daily max exceeded, same-subject non-consecutive

Conflict types are defined as `CONFLICT_TYPES` constants with Korean labels in `CONFLICT_LABELS`.

### Components

- **`SettingsTab`** — CRUD for grades, special rooms, subjects/modules, and teachers. Supports drag-to-trash deletion and batch room input.
- **`GradeViewTab`** — Per-grade/class timetable view with auto-schedule (single grade or all), validation, morning priority toggle, and conflict navigation.
- **`RoomViewTab`** — Per-room timetable view showing all grades using that room.
- **`TimetableGrid`** — Shared grid component used by both views. Supports drag-and-drop (move/swap), real-time conflict detection on hover, half-period rendering, and per-cell delete.

### Excel Export (`src/utils/excelExport.js`)

Generates `시간표.xlsx` with one sheet per grade-class plus one sheet per special room.

## Key Design Patterns

- Entities use UUID `id` fields (via `uuid` package) — never use array indices as keys
- Rooms support both legacy string format and object format (`{ id, name, capacity }`) — helper functions like `getRoomName()` handle both
- `'교실'` (classroom) is a virtual room with unlimited capacity, used as fallback when `allowClassroomFallback` is enabled
- Subject modules support multiple `locations[]` (array of room names the scheduler can choose from)
- All UI text is in Korean; the app targets Korean elementary school teachers
- Subject color classes are defined in `index.css` and mapped by room name in `getSubjectColorClass()`

## ESLint Config

Flat config in `eslint.config.js`. Notable rule: `no-unused-vars` ignores variables starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`).
