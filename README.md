# Proviyaa Master Admin - Full-Stack Platform

[![CI Pipeline](https://github.com/proviaa-master/master-admin/actions/workflows/ci.yml/badge.svg)](https://github.com/proviaa-master/master-admin/actions/workflows/ci.yml)
[![Backend CI](https://github.com/proviaa-master/master-admin/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/proviaa-master/master-admin/actions/workflows/backend-ci.yml)
[![CodeQL Security](https://github.com/proviaa-master/master-admin/actions/workflows/codeql.yml/badge.svg)](https://github.com/proviaa-master/master-admin/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade, enterprise full-stack platform consisting of a **React 18 + Vite + TypeScript + Tailwind CSS** frontend and an **Express + TypeScript + Supabase (PostgreSQL)** backend, hosted under the **[proviaa-master](https://github.com/orgs/proviaa-master/)** organization.

---

## 📑 Table of Contents
1. [Installation Steps to Local](#1-installation-steps-to-local)
2. [Developer Rules and Conditions](#2-developer-rules-and-conditions)
3. [Environment Variables & How They Are Achieved](#3-environment-variables--how-they-are-achieved)

---

## 1. Installation Steps to Local

### Prerequisites
Ensure the following tools are installed on your machine:
- **Node.js**: `v20.x LTS` ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.x` or higher (bundled with Node.js)
- **Git**: Installed and configured ([Download Git](https://git-scm.com/))
- **Supabase Account**: A free Supabase project for database and authentication ([supabase.com](https://supabase.com))

---

### Option A: Quickstart (Both Services Concurrently)

```bash
# 1. Clone the repository
git clone https://github.com/proviaa-master/master-admin.git
cd master-admin

# 2. Install all dependencies (root, backend, and frontend)
npm run install:all

# 3. Configure environment files (see Section 3 for details)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Start both frontend and backend concurrently
npm run dev
```
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000/api`
- **Health Check**: `http://localhost:8000/api/health`

---

### Option B: Step-by-Step Manual Setup

#### Step 1: Clone the Repository
```bash
git clone https://github.com/proviaa-master/master-admin.git
cd master-admin
```

#### Step 2: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies using lockfile
npm ci

# Create your local environment file
cp .env.example .env
# Open .env and fill in your Supabase & JWT values (see Section 3)

# (Optional) Run SQL database migrations
npm run migrate

# Start backend in development watch mode
npm run dev
```
The backend server will start on `http://localhost:8000`.

#### Step 3: Frontend Setup
Open a new terminal window:
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies using lockfile
npm ci

# Create your local environment file
cp .env.example .env
# Open .env and configure VITE_ variables (see Section 3)

# Start Vite development server
npm run dev
```
The frontend will start on `http://localhost:5173`.

#### Step 4: Verify Local Installation
1. Open your browser and navigate to `http://localhost:5173`.
2. Check the API health response at `http://localhost:8000/api/health`. You should receive:
   ```json
   {
     "status": "UP",
     "timestamp": "...",
     "uptime": 12.34,
     "environment": "development"
   }
   ```

---

## 2. Developer Rules and Conditions

To maintain enterprise code quality, stability, and security, all contributors must strictly adhere to the following rules:

### A. Frontend Rules
1. **TypeScript Strictness**:
   - `strict: true` is enforced in `tsconfig.json`.
   - Never use `any`. Define explicit interfaces or types for all components, props, hooks, and API responses.
   - Code must pass `npm run typecheck` with **0 errors**.
2. **Linting & Code Style**:
   - **ESLint**: Adhere to React Hooks rules, React Refresh rules, and TypeScript-ESLint standards.
   - **Prettier**: Single quotes, 2 spaces, trailing commas, semicolons required. Code formatting is validated with `npm run format:check`.
3. **Component & Unit Testing**:
   - Every major page or complex UI component must have unit/integration tests using Vitest and React Testing Library in `src/test/`.
   - All tests must pass cleanly (`npm run test`).
4. **Clean Production Bundling**:
   - Do not leave unused imports or dead code.
   - Production Vite builds must compile cleanly without warnings (`npm run build`).

---

### B. Backend Rules & Runtime Restrictions
1. **Security Headers (Helmet)**:
   - All HTTP responses must carry standard Helmet security headers (HSTS, Content Security Policy, X-Content-Type-Options, Frameguard).
2. **CORS Origin Whitelisting**:
   - Only explicitly whitelisted client origins (`http://localhost:5173`, `http://localhost:3000`, and `CLIENT_ORIGIN`) are permitted to communicate with the API. Unauthorized origins receive an HTTP CORS rejection.
3. **Strict Rate Limiting**:
   - **Global Limiter**: Maximum 200 requests per 15-minute window per IP.
   - **Auth Endpoints Limiter**: Maximum 15 requests per 15-minute window per IP on `/api/v1/auth/*` to prevent brute-force attacks.
4. **Payload Size Restrictions (Anti-DoS)**:
   - Request bodies are strictly capped at **1MB** (`express.json({ limit: "1mb" })`). Payloads exceeding this limit receive an `HTTP 413 Payload Too Large`.
5. **Input Validation & SQL Safety**:
   - Every incoming request body and query param must be validated using a **Zod** schema.
   - **Never concatenate raw strings into SQL queries**. Always use parameterized queries or Supabase query builders to prevent SQL injection.
6. **Database Migration Rules**:
   - All schema modifications must be recorded as timestamped SQL files in `backend/migrations/<timestamp>_<name>.sql`.
   - Migration files must never be empty and must follow SQL naming conventions.
7. **Containerization Integrity**:
   - The backend must remain container-agnostic. The multi-stage `backend/Dockerfile` must build without errors.

---

### C. Automated CI Quality Gates (GitHub Actions)
Every Pull Request and push to `main` or `develop` triggers two parallel CI pipelines:
- **`CI Pipeline` (Frontend)**: Linting, Prettier, TypeScript Typecheck, Vitest Unit Tests, Vite Production Build & Bundle Size Analysis.
- **`Backend CI Pipeline` (Backend)**: ESLint, Prettier, Strict Typecheck, Supertest API/Security Tests, SQL Migration Validation, `tsc` compilation to `dist/index.js`, and Docker Build Verification.

> [!IMPORTANT]
> **Zero Tolerance Policy**: Pull request merges are **automatically blocked** if any CI stage fails.

---

### D. The Developer Workflow (Step-by-Step)

```mermaid
flowchart LR
    A["1. git checkout develop<br/>(pull latest)"] --> B["2. Create feature branch<br/>(feature/name)"]
    B --> C["3. Develop & Test Locally"]
    C --> D["4. Run Pre-Commit Checklist"]
    D --> E["5. Commit (Conventional) & Push"]
    E --> F["6. Open PR targeting develop"]
    F --> G["7. CI Passes (Green) & Merge"]
```

#### Pre-Commit Verification Checklist
Before committing and pushing your code, run these verification commands locally:

```bash
# From the repository root (runs on both frontend & backend):
npm run format:check   # Verifies formatting
npm run lint           # Verifies ESLint rules (use 'npm run format:write' and 'npm run lint:fix' to fix)
npm run typecheck      # Strict TypeScript check (0 errors)
npm run test           # Executes all unit and integration tests
npm run build          # Verifies production bundling for both services
```

#### Commit Message Convention
Use standard Conventional Commits:
- `feat: <description>` - A new feature
- `fix: <description>` - A bug fix
- `refactor: <description>` - Code change that neither fixes a bug nor adds a feature
- `test: <description>` - Adding or updating tests
- `chore: <description>` - Build process, tooling, or dependency updates

---

## 3. Environment Variables & How They Are Achieved

### A. Backend Variables (`backend/.env`)

| Variable | Type | Default | Description | How to Obtain / Achieve |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Number | `8000` | Port on which Express server listens | Set to `8000` or any available local port. |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`) | Use `development` locally. CI uses `test`. |
| `BASE_PATH` | String | `/api` | Root prefix for all API routes | Kept as `/api` to standardise API endpoints. |
| `CLIENT_ORIGIN` | String | `http://localhost:5173` | Allowed frontend origin(s) for CORS, comma separated. The first entry is also where password-reset emails link to (`<origin>/reset-password`) | Set to your local Vite URL (`http://localhost:5173`) or the production Master Admin URL. Add `<origin>/reset-password` to the Supabase Auth redirect allow-list. |
| `SUPABASE_URL` | URL | - | Supabase project REST API endpoint | **Supabase Dashboard**: Go to **Project Settings** > **API** > copy **Project URL**. |
| `SUPABASE_ANON_KEY` | String | - | Public anonymous API key for Supabase client | **Supabase Dashboard**: Go to **Project Settings** > **API** > copy **Project API Keys** (`anon` / `public`). |
| `DATABASE_URL` | URI | - | Direct PostgreSQL connection string for SQL migrations | **Supabase Dashboard**: Go to **Project Settings** > **Database** > **Connection string** > select **URI** (Session or Transaction mode) and insert your database password. |
| `JWT_SECRET` | String | - | 256-bit secret key used to sign and verify auth tokens | **Generate via Terminal**: Run the command below to generate a secure random key:<br/>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | String | `7d` | Token lifespan | Set to `7d` (7 days) or `24h` depending on security requirements. |

#### Backend `.env` Example:
```env
PORT=8000
NODE_ENV=development
BASE_PATH=/api
CLIENT_ORIGIN=http://localhost:5173

# Supabase Credentials
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# PostgreSQL Direct Connection for Migrations
DATABASE_URL=postgresql://postgres.xyzcompany:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# JWT Secret (Generated via crypto.randomBytes)
JWT_SECRET=4f8b92d6e3c1a85f7e0d2b4c6a8f1e3d5b7c9a1e3f5d7b9c1a3e5f7d9b1c3a5e
JWT_EXPIRES_IN=7d
```

---

### B. Frontend Variables (`frontend/.env`)

> [!NOTE]
> Vite requires client-accessible environment variables to be prefixed with `VITE_`. Any variable without this prefix is omitted from the client bundle for security.

| Variable | Type | Default | Description | How to Obtain / Achieve |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | String | `/api` | Base URL used by Axios/Fetch to reach backend API | Set to `/api` (proxied by Vite) or `http://localhost:8000/api` for direct local development. |

#### Frontend `.env` Example:
```env
# Backend API Base URL
VITE_API_BASE_URL=/api
```

The browser talks only to the backend (no Supabase client or key in the frontend). Sessions: the backend
returns a short-lived access token (kept in memory) and sets the Supabase refresh token as an httpOnly
cookie on `/api/auth`; the app refreshes before expiry and once on a 401.

---

### C. Step-by-Step Guide: How to Obtain Supabase Credentials

1. **Log In to Supabase**:
   - Visit [supabase.com](https://supabase.com) and log in or create an account.
2. **Create or Open Your Project**:
   - Click **New Project**, select your organization, choose a region close to your users, and define a database password (save this password securely).
3. **Get API Keys (`SUPABASE_URL` & `SUPABASE_ANON_KEY`)**:
   - In the left sidebar, click the gear icon (⚙️) to open **Project Settings**.
   - Click **API**.
   - Under **Project URL**, copy the URL (e.g., `https://abcdefghijkl.supabase.co`).
   - Under **Project API keys**, find the key named **`anon` `public`** and click **Copy**.
4. **Get Connection String (`DATABASE_URL`)**:
   - In **Project Settings**, click **Database**.
   - Scroll down to **Connection string**.
   - Select the **URI** tab.
   - Copy the string and replace `[YOUR-PASSWORD]` with the database password set in Step 2.
5. **Paste into `.env` Files**:
   - Copy the values into `backend/.env` and `frontend/.env`.
