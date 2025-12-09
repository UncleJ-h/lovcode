# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lovcode is a Vibe Coding assistant desktop app built with Tauri 2 + React 19 + TypeScript. Primary focus is supporting AI coding tool ecosystems (claude code, codex, etc.) with chat history viewer as the first feature.

## Commands

```bash
# Frontend development (hot reload)
pnpm dev

# Type check + production build
pnpm build

# Run Tauri desktop app (auto-starts pnpm dev)
pnpm tauri dev

# Build distributable
pnpm tauri build
```

## Architecture

**Dual-layer architecture:**
- `src/` - React frontend (Vite, port 1420)
- `src-tauri/` - Rust backend (Tauri 2)

**Frontend-backend communication:**
- Use `invoke()` from `@tauri-apps/api/core` to call Rust commands
- Define Rust commands with `#[tauri::command]` in `src-tauri/src/lib.rs`
- Register commands in `tauri::generate_handler![]`

## Conventions

- CSS: Tailwind CSS preferred
- No dynamic imports or setTimeout unless necessary
- Extract shared components when patterns repeat across multiple components
- 不要执行pnpm build等，因为本地在运行 pnpm tauri dev