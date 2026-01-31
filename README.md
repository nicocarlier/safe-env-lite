# safe-env-lite

Define env vars once & get validated, typed, and safe access to them everywhere — minimal, zero-boilerplate.

## Features

- **Type-safe** — Full TypeScript inference with literal types
- **Fail-fast** — Throws on startup with clear error messages
- **Zero dependencies** — No runtime schema libraries
- **Minimal API** — One function: `createEnv()`
- **Immutable** — Returns frozen object to prevent mutation
- **Flexible** — Supports strings, numbers, booleans, enums, defaults, and nullable values

## Installation

```bash
npm install safe-env-lite
```

## Quick Start

```typescript
// src/env.ts
import { createEnv } from "safe-env-lite";

export const env = createEnv({
  NODE_ENV: ["development", "test", "production"],
  PORT: { type: "number", default: 3000 },
  DEBUG: { type: "boolean", default: false },
  DATABASE_URL: { type: "string", required: true },
  API_KEY: { type: "string", nullable: true }
});


```
