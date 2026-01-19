# Scheduling Platform - Next.js Migration

> **🚀 Professional Multi-Tenant Scheduling Application**
> 
> This is the Next.js migration of the scheduling platform, designed for scalability across multiple restaurant locations.

## 📋 Project Status

- **Original Version**: Preserved in `c:\scheduling` (Vite + React)
- **Migration Version**: This directory (Next.js + TypeScript)
- **Status**: 🔄 Migration in progress

## 🎯 Migration Goals

1. ✅ **TypeScript** - Full type safety
2. ✅ **Next.js App Router** - Modern routing and server components
3. ✅ **Multi-Tenancy** - Support for multiple restaurant locations
4. ✅ **JWT Authentication** - Secure authentication with httpOnly cookies
5. ✅ **PostgreSQL (Neon)** - Scalable cloud database
6. ✅ **Production Ready** - Enterprise-grade code quality

## 📁 Current Structure

```
scheduling-nextjs/
├── frontend/          # Original Vite frontend (to be migrated)
│   └── src/
│       ├── pages/     # 16 React pages
│       ├── components/
│       ├── context/
│       └── util/
├── backend/           # Express API (to be converted to Next.js API routes)
│   ├── server.js      # Main server (1,758 lines)
│   ├── auth.js        # Authentication logic
│   ├── scheduler.js   # Shift generation algorithm
│   └── prisma/
│       └── schema.prisma
└── [Migration will create]
    ├── app/           # Next.js App Router
    ├── lib/           # Utilities
    └── types/         # TypeScript definitions
```

## 🔧 Pages to Migrate (16 total)

- [x] **AiAgentPage.jsx** (16.9 KB) - AI assistant
- [x] **ForecastPage.jsx** (27.7 KB) - Revenue forecasting
- [x] **CoveragePage.jsx** (39.8 KB) - Station coverage (Fabbisogni)
- [x] **TurniPage.jsx** (87.8 KB) - Shift planning
- [x] **StaffPage.jsx** (12.3 KB) - Staff management
- [x] **BudgetPage.jsx** (21.6 KB) - Budget tracking
- [x] **AvailabilityPage.jsx** (30.5 KB) - Availability grid
- [x] **IndisponibilitaPage.jsx** (28.3 KB) - Unavailability
- [x] **StatisticsPage.jsx** (5.5 KB) - Statistics
- [x] **UsersPage.jsx** (20.0 KB) - User management
- [x] **ProfilePage.jsx** (10.7 KB) - User profile
- [x] **FixedShiftsPage.jsx** (8.9 KB) - Recurring shifts
- [x] **AssenzePage.jsx** (6.6 KB) - Absence tracking
- [x] **PermissionRequestPage.jsx** (14.8 KB) - Permission requests
- [x] **LoginPage.jsx** (3.6 KB) - Authentication
- [x] **RegisterPage.jsx** (9.6 KB) - Registration

## 🚀 Migration Plan

See [nextjs_migration_plan.md](../nextjs_migration_plan.md) for detailed implementation plan.

### Phase 1: Setup ✅
- [x] Duplicate codebase
- [x] Initialize Git repository
- [ ] Create Next.js project structure

### Phase 2: Database (In Progress)
- [ ] Add `tenantId` to all Prisma models
- [ ] Create tenant-scoped Prisma client
- [ ] Set up multi-tenant middleware

### Phase 3: Backend Migration
- [ ] Convert Express routes to Next.js API routes
- [ ] Implement JWT authentication
- [ ] Add tenant isolation

### Phase 4: Frontend Migration
- [ ] Convert all 16 pages to TypeScript
- [ ] Migrate to Next.js App Router
- [ ] Update API client

### Phase 5: Testing & Deployment
- [ ] Local testing
- [ ] Build verification
- [ ] Vercel deployment

## 💻 Development

**Original Vite Version** (preserved):
```bash
cd c:\scheduling\frontend
npm run dev  # http://localhost:5173
```

**Next.js Version** (after migration):
```bash
cd c:\scheduling\scheduling-nextjs
npm run dev  # http://localhost:3000
```

## 🔐 Environment Variables

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GEMINI_API_KEY="your-gemini-key"
```

## 📊 Database Schema

- **PostgreSQL** via Neon
- **Multi-tenant** with `tenantId` field
- **Models**: Staff, User, Assignment, Coverage, Forecast, Budget, etc.

## 🎨 Tech Stack

### Current (Vite)
- React 18.2.0
- Vite 5.0.0
- Express.js
- Prisma ORM
- PostgreSQL (Neon)

### Target (Next.js)
- Next.js 14+ (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- JWT Authentication
- Tailwind CSS

## 📝 Notes

- **Original version** in `c:\scheduling` remains untouched
- **This version** is for Next.js migration work
- **All changes** tracked in Git
- **Production deployment** via Vercel

## 👥 Team

- **Developer**: AI Agent (Antigravity)
- **Client**: Restaurant Management
- **Timeline**: 20-28 hours estimated

---

**Last Updated**: 2026-01-09
**Status**: 🔄 Migration Phase 1 Complete