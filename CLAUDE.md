# F2K-Projects CLAUDE.md

## Supabase Automation

### Running Migrations
```bash
cd "C:\Users\denni\PycharmProjects\F2K-Projects"
powershell -File scripts/supabase-push-migration.ps1
```

### Running Queries
```bash
cd "C:\Users\denni\PycharmProjects\F2K-Projects"
powershell -File scripts/supabase-query.ps1 "SELECT * FROM table LIMIT 10"
```

### Project Ref
- `zzajvnhsesqrrepflrrx` (f2k-projects — **Sydney `ap-southeast-2`**, live since 2026-06-27)
- `earqebbwhklxadqawtex` — OLD Seoul project, decommissioned after the residency cutover; do NOT target.

### Key Tables
- `seafields_lot_allocations` - Seafields lots with pricing
- `branscombe_registrations` - Branscombe registrations
- `seafields_registrations` - Seafields registrations

## Build Commands
- `npm run dev` - Start dev server
- `npx tsc --noEmit` - TypeScript check
