# Tests

This directory holds cross-package and end-to-end tests for ForgeAI.

## Module 0 status

No test runner is configured yet. That is a deliberate choice: Module 0 introduces
**abstractions, not behaviour**, and the only genuinely testable units (the in-memory
key/value store, the permission policy and the guarded tool executor) are small enough to
be verified by type-checking and manual reasoning at this stage.

Adding a test framework (for example [Vitest](https://vitest.dev)) is planned for the first
module that introduces real behaviour. Introducing it now would mean writing tests for code
that does not exist yet.

## Planned layout

```
tests/
├── unit/          # per-package unit tests (permission policy, tool executor, config)
├── integration/    # packages working together (provider + agent + tools)
└── e2e/            # Tauri end-to-end tests
```

## What will be tested first (Module 1+)

1. `ConfigService` round-trips configuration without leaking credentials.
2. `PermissionManager` denies `DANGEROUS` actions by default.
3. `GuardedToolExecutor` never executes a tool when authorisation is denied.
4. Provider adapters produce well-formed `ChatChunk` streams.
