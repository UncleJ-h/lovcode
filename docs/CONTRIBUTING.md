# Contributing to Lovcode

Thank you for your interest in contributing to Lovcode! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** 20+ (we recommend using [fnm](https://github.com/Schniz/fnm))
- **pnpm** 10+ (`npm install -g pnpm`)
- **Rust** stable (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Tauri CLI** (`cargo install tauri-cli`)

### Clone & Install

```bash
git clone https://github.com/lovable-dev/lovcode.git
cd lovcode
pnpm install
```

### Run Development Mode

```bash
pnpm tauri dev
```

This starts both the Vite dev server (hot reload) and the Tauri app.

---

## Project Structure

```
lovcode/
├── src/                # React frontend
├── src-tauri/          # Rust backend
├── docs/               # Documentation
├── e2e/                # E2E tests
└── marketplace/        # Community templates
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed structure.

---

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` types
- Prefer `const` over `let`
- Use descriptive variable names

### Rust

- No `.unwrap()` - use proper error handling
- No `panic!` - return `Result<T, E>`
- Use `thiserror` for error types
- Follow Clippy recommendations

### Git Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(chat): add session export feature
fix(workspace): resolve file tree crash
docs(api): update command reference
refactor(store): simplify navigation state
test(hooks): add useNavigate tests
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write code following our standards
- Add tests for new features
- Update documentation if needed
- Update CLAUDE.md files if architecture changes

### 3. Run Checks

```bash
# TypeScript
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Rust
pnpm clippy
```

### 4. Submit PR

- Fill out the PR template completely
- Link related issues
- Add screenshots for UI changes
- Request review from CODEOWNERS

---

## Testing

### Frontend Tests (Vitest)

```bash
pnpm test              # Watch mode
pnpm test --run        # Single run
pnpm test:coverage     # With coverage report
```

### Backend Tests (Cargo)

```bash
cd src-tauri
cargo test
```

### E2E Tests (Playwright)

```bash
pnpm test:e2e          # Headless
pnpm test:e2e:ui       # Interactive UI
```

---

## Adding Features

### New Frontend View

1. Create `src/views/MyView.tsx`
2. Add View type to `src/types/index.ts`
3. Add route in `src/components/AppRouter.tsx`
4. Add navigation in `src/hooks/useAppNavigation.ts`
5. Update `src/views/CLAUDE.md`

### New Tauri Command

1. Create function in `src-tauri/src/commands/*.rs`
2. Export from `commands/mod.rs`
3. Register in `lib.rs`
4. Add TypeScript types
5. Document in `docs/API.md`
6. Update `src-tauri/CLAUDE.md`

### New Template Category

1. Add to `TemplateCategory` type
2. Update marketplace module
3. Add UI tab
4. Create install handler

---

## Documentation

We follow the GEB Fractal Protocol:

- **L1**: `/CLAUDE.md` - Project constitution
- **L2**: `/{module}/CLAUDE.md` - Module documentation
- **L3**: File headers with INPUT/OUTPUT/POS

When you change code:
1. Check if L3 header needs update
2. Check if L2 CLAUDE.md needs update
3. Check if L1 CLAUDE.md needs update

---

## Security

Please report security vulnerabilities privately to:
security@lovable.dev

Do NOT create public issues for security problems.

When contributing:
- Validate all user inputs
- Use `security.rs` utilities for paths
- Never hardcode secrets
- Consider path traversal attacks
- Consider command injection

---

## Getting Help

- **Discussions**: [GitHub Discussions](https://github.com/lovable-dev/lovcode/discussions)
- **Issues**: [GitHub Issues](https://github.com/lovable-dev/lovcode/issues)
- **Documentation**: [docs/](./docs/)

---

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing!
