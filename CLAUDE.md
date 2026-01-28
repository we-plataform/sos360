# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lia360 is a lead management and outbound prospecting SaaS platform. It captures leads from social media platforms via a Chrome extension, manages them through a Kanban-style pipeline, and enables automated outreach.

**Core Features**:
- Lead capture from social platforms (LinkedIn, Instagram, Facebook, X)
- Kanban-style pipeline management
- Automated outreach and workflows
- Multi-workspace collaboration
- AI-powered lead qualification
- Audience segmentation and targeting

## Commands

```bash
# Development - start all apps (API + Web)
npm run dev

# Start individual apps
npm run api:dev          # API at http://localhost:3001
npm run web:dev          # Web at http://localhost:3000

# Database (Prisma)
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database (dev)
npm run db:migrate       # Create and apply migrations (prod)
npm run db:studio        # Open Prisma Studio GUI

# Docker (local PostgreSQL + Redis)
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
npm run docker:reset     # Reset with fresh volumes

# Build
npm run build            # Build all workspaces via Turbo
npm run build:api        # Build only API and its dependencies
```

## Architecture

### Monorepo Structure (Turborepo)
- **apps/api**: Express.js REST API + Socket.io (Node.js ESM, TypeScript)
- **apps/web**: Next.js 14 frontend with Tailwind CSS
- **apps/extension**: Chrome Manifest V3 extension (vanilla JS)
- **packages/database**: Prisma schema and client
- **packages/shared**: Zod schemas, types, and constants

### Multi-Tenancy Model
Three-level hierarchy: **Company → Workspace → User**
- Users can belong to multiple companies
- Each company has multiple workspaces
- Leads, pipelines, and conversations are workspace-scoped
- Role hierarchy at company level: owner > admin > member
- Role hierarchy at workspace level: owner > admin > manager > agent > viewer

### Key Patterns

**API Authentication**:
- JWT with access + refresh tokens
- `authenticate` middleware attaches `req.user` with company/workspace context
- Authorization via `authorize()` and `authorizeCompany()` middleware

**Data Flow**:
1. Chrome extension scrapes social profiles (LinkedIn, Instagram, Facebook, X)
2. Background script sends to `/api/v1/leads/import`
3. API validates with Zod schemas, stores via Prisma
4. Frontend fetches via React Query with automatic token refresh
5. Real-time updates via Socket.io

**Validation**:
- All API inputs validated with Zod (schemas in `packages/shared/src/schemas/`)
- Shared schemas between API and frontend

### Database
- PostgreSQL hosted on Neon (serverless PostgreSQL)
- `DATABASE_URL`: primary connection with SSL
- `DIRECT_URL`: direct connection for migrations (same as DATABASE_URL for Neon)
- Redis optional (falls back to in-memory for cache/rate-limiting)

## Key Files

- `apps/api/src/routes/index.ts` - API route setup
- `apps/api/src/middleware/auth.ts` - Authentication middleware
- `packages/database/prisma/schema.prisma` - Full data model
- `packages/shared/src/schemas/` - Zod validation schemas
- `apps/web/src/lib/api.ts` - Frontend API client with token refresh

## Environment Variables

Required for development:
```env
DATABASE_URL=postgresql://...      # Neon connection string
DIRECT_URL=postgresql://...        # Same as DATABASE_URL for Neon
JWT_SECRET=<min 32 chars>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Chrome Extension

Load in developer mode:
1. `chrome://extensions` → Enable Developer Mode
2. "Load unpacked" → Select `apps/extension` folder
3. Extension connects to API via `VITE_API_URL` or defaults to localhost:3001

**Content Scripts**:
- `content-scripts/linkedin.js` - LinkedIn profile scraping
- `content-scripts/dashboard-sync.js` - Dashboard synchronization

**Extension Flow**:
1. User visits social profile (LinkedIn, Instagram, etc.)
2. Content script extracts profile data
3. Background script sends to `/api/v1/leads/import`
4. Lead appears in Kanban board

## API Routes Structure

**Core Routes** (`apps/api/src/routes/`):
- `index.ts` - Main route aggregator
- `auth.ts` - Authentication endpoints (login, register, token refresh)
- `leads.ts` - Lead CRUD, import, and management
- `pipelines.ts` - Pipeline and stage management
- `automations.ts` - Workflow automation rules
- `audiences.ts` - Audience segmentation and targeting

**Authentication Pattern**:
```typescript
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';

router.post('/', authenticate, authorize('workspace', 'admin'), createHandler);
```

## Frontend Structure

**Pages** (`apps/web/src/app/`):
- `(auth)/` - Authentication flow (login, register, context selection)
- `(dashboard)/dashboard/` - Main application
  - `leads/` - Lead management with Kanban board
  - `audiences/` - Audience segmentation
  - `automations/` - (Removed - see KanbanBoard for automation features)

**Key Components**:
- `components/kanban/KanbanBoard.tsx` - Main Kanban interface
- `components/kanban/KanbanColumn.tsx` - Column rendering
- `components/leads/LeadDetailModal.tsx` - Lead detail view
- `components/providers.tsx` - Global providers (Socket.io, React Query)

**UI Library**:
- Built with shadcn/ui components
- Available components: dialog, label, select, textarea, toaster, button, card, etc.
- Located in `components/ui/`

## Development Patterns

**When Working on Features**:

1. **Schema Changes**:
   - Update `packages/database/prisma/schema.prisma`
   - Run `npm run db:generate` to update Prisma client
   - Run `npm run db:push` for dev or `npm run db:migrate` for prod
   - Update Zod schemas in `packages/shared/src/schemas/`

2. **API Endpoints**:
   - Create route handler in `apps/api/src/routes/`
   - Validate input with Zod schemas
   - Use `authenticate` middleware for protected routes
   - Use `authorize()` for role-based access control

3. **Frontend Components**:
   - Use React Query for data fetching (`apps/web/src/lib/api.ts`)
   - Implement optimistic updates for better UX
   - Socket.io for real-time updates
   - Follow existing component patterns

4. **Extension Updates**:
   - Update `manifest.json` for permissions
   - Modify content scripts for new data extraction
   - Test in Chrome developer mode

5. **Logging Best Practices**:
   - **Never use bare console.log in production code**
   - Always wrap console.log with NODE_ENV check: `if (process.env.NODE_ENV === 'development') { console.log(...); }`
   - Example pattern for development-only logging:
     ```typescript
     if (process.env.NODE_ENV === 'development') {
       console.log('Debug info:', data);
     }
     ```
   - **Error logging**: Use console.error for errors (allowed in production)
   - **Never log sensitive data**:
     - No passwords, tokens, or API keys
     - No full user objects (sanitize first)
     - No request bodies with PII
   - **Use structured logging** for API routes:
     ```typescript
     console.error(`[${new Date().toISOString()}] Error in ${req.path}:`, error.message);
     ```

## Database Schema Highlights

**Key Models**:
- `Lead` - Core lead entity with social profile data
- `Pipeline` - Customizable workflow stages
- `Stage` - Individual stages within pipelines
- `Automation` - Workflow automation rules
- `Audience` - Segmented lead groups
- `Enrichment` - AI-powered lead qualification data

**LinkedIn-Specific Fields** (Lead model):
- `linkedinProfileUrl` - Profile URL
- `linkedinHeadline` - Professional headline
- `linkedinAbout` - About section
- `linkedinExperience` - Work history
- `linkedinEducation` - Education history
- `linkedinSkills` - Skills and endorsements
- `linkedinConnections` - Connection count
- `linkedinFollowerCount` - Follower metrics

## Troubleshooting

**Common Issues**:

1. **Database Connection Issues**:
   - Ensure Docker containers running: `npm run docker:up`
   - Check DATABASE_URL includes ?sslmode=require
   - Check DIRECT_URL matches DATABASE_URL for Neon

2. **Extension Not Connecting**:
   - Check API is running: `npm run api:dev`
   - Verify `VITE_API_URL` in extension or default localhost:3001
   - Reload extension after code changes

3. **Prisma Client Issues**:
   - Regenerate client: `npm run db:generate`
   - Restart dev server after schema changes

4. **Authentication Errors**:
   - Check JWT_SECRET is set (min 32 chars)
   - Verify tokens in browser localStorage
   - Check token refresh logic in `apps/web/src/lib/api.ts`
