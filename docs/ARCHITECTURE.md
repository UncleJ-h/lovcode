# Lovcode Architecture

> Desktop companion for AI Coding Tools

## Overview

Lovcode is a Tauri 2 desktop application that serves as a companion for Claude Code and other AI coding assistants. It provides project management, session browsing, template marketplace, and advanced features for power users.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Lovcode Desktop                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │                  │    │                                   │   │
│  │   React 19 UI    │◄───│     Tauri IPC Bridge             │   │
│  │   + Jotai State  │    │     (invoke / events)            │   │
│  │                  │    │                                   │   │
│  └──────────────────┘    └──────────────────────────────────┘   │
│           │                              │                       │
│           ▼                              ▼                       │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │                  │    │                                   │   │
│  │  Vite + TS       │    │     Rust Backend                 │   │
│  │  Tailwind CSS    │    │     - Commands (11 modules)      │   │
│  │  shadcn/ui       │    │     - Services (search)          │   │
│  │                  │    │     - PTY Manager                │   │
│  └──────────────────┘    └──────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Resources                          │
├─────────────────────────────────────────────────────────────────┤
│  ~/.claude/          Claude Code data directory                  │
│  ~/.config/claude/   Claude settings & MCP config                │
│  third-parties/      Git submodules (docs, templates)            │
│  marketplace/        Community templates                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript 5.8** | Type safety |
| **Vite 7** | Build tool & dev server |
| **Tailwind CSS 4** | Styling |
| **Jotai** | State management |
| **React Query** | Server state & caching |
| **shadcn/ui** | Component library |
| **Framer Motion** | Animations |
| **Monaco Editor** | Code editing |
| **xterm.js** | Terminal emulator |

### Backend (Rust)

| Technology | Purpose |
|------------|---------|
| **Tauri 2** | Desktop runtime |
| **Tantivy** | Full-text search engine |
| **jieba-rs** | Chinese text segmentation |
| **portable-pty** | Pseudo-terminal management |
| **notify** | File system watching |
| **thiserror** | Error type definitions |
| **tracing** | Structured logging |
| **reqwest** | HTTP client |

---

## Directory Structure

```
lovcode/
├── src/                      # React Frontend
│   ├── components/           # UI Components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── shared/           # Business components
│   │   └── ...
│   ├── views/                # Page views (14 modules)
│   ├── store/                # Jotai atoms
│   │   └── atoms/            # State slices
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript definitions
│   ├── lib/                  # Utilities
│   │   ├── sentry.ts         # Error tracking
│   │   ├── webVitals.ts      # Performance monitoring
│   │   ├── logger.ts         # Structured logging
│   │   └── utils.ts          # Helper functions
│   ├── context/              # React contexts
│   ├── constants/            # App constants
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
│
├── src-tauri/                # Rust Backend
│   └── src/
│       ├── lib.rs            # App entry (~800 lines)
│       ├── main.rs           # Binary entry
│       ├── errors.rs         # Error types
│       ├── security.rs       # Security utilities
│       ├── types.rs          # Shared types
│       ├── logging.rs        # Tracing setup
│       ├── pty_manager.rs    # PTY sessions
│       ├── workspace_store.rs # Workspace persistence
│       ├── diagnostics.rs    # Project analysis
│       ├── hook_watcher.rs   # File watching
│       ├── commands/         # Tauri commands (11 modules)
│       │   ├── mod.rs
│       │   ├── projects.rs
│       │   ├── settings.rs
│       │   ├── files.rs
│       │   ├── git.rs
│       │   ├── local_commands.rs
│       │   ├── agents.rs
│       │   ├── knowledge.rs
│       │   ├── marketplace/
│       │   ├── report.rs
│       │   └── version.rs
│       ├── services/         # Backend services
│       │   └── search.rs     # Tantivy + Jieba
│       └── logs/             # Log parsing
│           └── mod.rs        # NormalizedEntry
│
├── third-parties/            # Git submodules
├── marketplace/              # Community templates
├── docs/                     # Documentation
├── e2e/                      # E2E tests (Playwright)
└── .github/                  # CI/CD workflows
```

---

## Data Flow

### Frontend → Backend

```typescript
// Frontend: src/hooks/useInvokeQuery.ts
const { data } = useInvokeQuery<Project[]>(['projects'], 'list_projects');

// Backend: src-tauri/src/commands/projects.rs
#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    // Read ~/.claude/projects/...
}
```

### State Management

```
┌─────────────────────────────────────────────────────────────┐
│                      Jotai Atoms                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  navigationStateAtom ────► viewAtom (derived)                │
│         │                                                    │
│         ├── history: View[]                                  │
│         └── index: number                                    │
│                                                              │
│  settingsAtom ───────────► UI Components                     │
│  profileAtom                                                 │
│  marketplaceCategoryAtom                                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ atomWithStorage("lovcode:*") → localStorage          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Navigation Flow

```
User Click → handleFeatureClick() → navigate(View)
                                          │
                                          ▼
                              navigationStateAtom.set()
                                          │
                                          ▼
                               viewAtom → AppRouter → View Component
```

---

## Module Responsibilities

### Frontend Modules

| Module | Responsibility |
|--------|----------------|
| `views/` | 14 page views (Chat, Workspace, Commands, etc.) |
| `store/atoms/` | Application state (navigation, settings, UI) |
| `hooks/` | Data fetching, navigation, resize logic |
| `components/shared/` | NavSidebar, SidebarLayout, dialogs |
| `lib/` | Utilities, error handling, logging |

### Backend Modules

| Module | Responsibility |
|--------|----------------|
| `commands/projects.rs` | Project & session management |
| `commands/settings.rs` | Settings CRUD, editor integration |
| `commands/files.rs` | File operations, shell commands |
| `commands/git.rs` | Git operations (commit, log, revert) |
| `commands/marketplace/` | Template installation |
| `services/search.rs` | Full-text search with Tantivy |
| `pty_manager.rs` | Terminal session management |
| `workspace_store.rs` | Workspace state persistence |

---

## Security Model

### Path Validation

All file paths are validated in `security.rs`:

```rust
pub fn validate_decoded_path(path: &str) -> Result<PathBuf, LovError> {
    // Reject path traversal attempts
    // Canonicalize and verify under allowed directories
}
```

### Command Injection Prevention

Version strings are validated against semver:

```rust
pub fn validate_version(version: &str) -> Result<(), LovError> {
    static VERSION_RE: OnceLock<Regex> = OnceLock::new();
    let re = VERSION_RE.get_or_init(|| {
        Regex::new(r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$").unwrap()
    });
    // ...
}
```

### Atomic File Operations

All file writes use atomic operations:

```rust
pub fn atomic_write_string(path: &Path, content: &str) -> Result<(), LovError> {
    // 1. Write to temp file
    // 2. Sync to disk
    // 3. Rename atomically
}
```

### Content Security Policy

CSP configured in `tauri.conf.json`:
- `default-src: 'self'`
- `script-src: 'self'`
- `connect-src: 'self' + allowed APIs`

---

## Observability

### Error Tracking (Sentry)

```typescript
// src/lib/sentry.ts
initSentry();
captureException(error, context);
addBreadcrumb(message, category, data);
```

### Performance Monitoring (Web Vitals)

```typescript
// src/lib/webVitals.ts
initWebVitals();
// Tracks: CLS, INP, FCP, LCP, TTFB
// Poor metrics → Sentry alerts
```

### Structured Logging

```typescript
// Frontend: src/lib/logger.ts
const log = createLogger('component');
log.info('Action completed', { duration: 100 });
log.error('Failed', error, { context: 'value' });

// Backend: src-tauri/src/logging.rs
tracing::info!("Processing request");
tracing::error!(?error, "Operation failed");
```

### Bundle Analysis

```bash
pnpm build:analyze
# Generates dist/stats.html with treemap visualization
```

---

## Testing Strategy

### Unit Tests

```bash
# Frontend (Vitest)
pnpm test              # Watch mode
pnpm test --run        # Single run
pnpm test:coverage     # With coverage

# Backend (Cargo)
cd src-tauri && cargo test
```

### E2E Tests

```bash
# Playwright
pnpm test:e2e          # Headless
pnpm test:e2e:ui       # Interactive UI
```

### Coverage Targets

| Metric | Current | Target |
|--------|---------|--------|
| Frontend Unit | 79% | 80%+ |
| Backend Unit | 60% | 70%+ |
| E2E Critical Paths | ✓ | ✓ |

---

## Build & Deployment

### Development

```bash
pnpm install           # Install dependencies
pnpm tauri dev         # Start dev mode (hot reload)
```

### Production Build

```bash
pnpm build             # TypeScript + Vite build
pnpm tauri build       # Full desktop app bundle
```

### CI Pipeline

```yaml
# .github/workflows/ci.yml
- Lint (ESLint + Clippy)
- TypeScript check
- Frontend tests (Vitest)
- Backend tests (Cargo)
- Coverage gates (30%+)
- Security audit
```

---

## Extension Points

### Adding a New View

1. Create `src/views/NewView.tsx`
2. Add type to `View` union in `src/types/index.ts`
3. Add route case in `src/components/AppRouter.tsx`
4. Add navigation handler in `useAppNavigation.ts`

### Adding a New Tauri Command

1. Create function in `src-tauri/src/commands/*.rs`
2. Export from `commands/mod.rs`
3. Register in `lib.rs` handler
4. Add TypeScript types in `src/types/index.ts`
5. Document in `docs/API.md`

### Adding a Template Category

1. Add category to `TemplateCategory` type
2. Update `get_templates_catalog` in marketplace
3. Add UI tab in `MarketplaceView.tsx`
4. Create install handler

---

## Performance Considerations

### Frontend

- **React.memo**: Applied to heavy components
- **Virtualization**: Used for long lists (react-virtual)
- **Code Splitting**: Lazy load routes
- **Bundle Size**: Monitored with visualizer

### Backend

- **Async Operations**: Non-blocking file I/O
- **Connection Pooling**: For HTTP requests
- **Caching**: Search index in memory
- **Streaming**: Large file reads

---

## Known Limitations

1. **Single Window**: Currently no multi-window support
2. **Offline Only**: No cloud sync
3. **Claude Code Focus**: Primary support for Claude Code
4. **macOS Priority**: Primary development on macOS

---

## Future Roadmap

- [ ] Multi-agent support (Cursor, Windsurf, etc.)
- [ ] Session forking and branching
- [ ] Cloud sync (optional)
- [ ] Plugin system
- [ ] Team collaboration features
