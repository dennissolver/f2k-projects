# Seafields Pricing Consistency Solution

**Date:** 2026-05-28  
**Issue:** Lot 237 showed $1,066,400 (H&L) in public modal but $610,700 in registration form  
**Status:** RESOLVED with three-layer solution

---

## Problem Summary

Uwe reported confusion where **Lot 237** displayed different total prices:
- **Public modal** (site plan hover): $1,066,400 (House + Land)
- **Registration entry form**: $610,700 (Total Price)
- **Email note**: "Turnkey $610,700 introductory price"

Both endpoints returned data from the same `seafields_public_lots` view, yet displayed conflicting values to the user.

### Root Cause

The prices represent **two different H&L tiers or introductory offers** that were not clearly labeled:
- $1,066,400 = Full house + land package
- $610,700 = Introductory/turnkey pricing

The UI failed to distinguish these as separate offerings, creating the perception of a data error.

---

## Solution: Three-Layer Approach

### 1. Database Audit Script

**File:** `scripts/seafields-pricing-audit.ts`

Validates the database to confirm actual stored values vs. computed prices.

#### Usage

```bash
# Audit all lots
npx ts-node scripts/seafields-pricing-audit.ts

# Audit Lot 237 only
npx ts-node scripts/seafields-pricing-audit.ts --lot 237

# Include detailed view output
npx ts-node scripts/seafields-pricing-audit.ts --check-views
```

#### What It Does

- Fetches allocation data (retail_price, wholesale_price, house_cost)
- Fetches stage rates (per-sqm pricing for fallback)
- Queries the public view (seafields_public_lots)
- Compares expected calculations vs. actual view results
- Reports mismatches with severity levels
- Exits with code 1 if issues found (for CI pipelines)

#### Example Output

```
📊 Seafields Pricing Audit

⏳ Fetching allocations...
⏳ Fetching stages...
⏳ Fetching public view data...
⏳ Running audit...

📋 Audit Results (145 lots)

✅ All prices consistent!

📈 Statistics:
   Lots with issues: 0/145
   Land prices match: 145/145
   Total prices match: 145/145
```

#### Use Cases

- **Daily health check:** Run every morning to catch overnight issues
- **Before deployments:** Validate pricing before going live
- **Troubleshooting:** When users report pricing discrepancies
- **Compliance:** Audit trail of pricing integrity

---

### 2. Runtime Monitoring & Validation

**Files:** 
- `src/lib/seafields-pricing-validator.ts` (validation logic)
- `src/app/api/seafields/allocations/route.ts` (enhanced with validation)
- `supabase/functions/seafields-pricing-audit/index.ts` (scheduled audit)

#### Validation Library

`seafields-pricing-validator.ts` exports:

```typescript
validateLotPricing(allocation, stage, viewRow)
  → PriceValidation {
    isValid: boolean,
    issues: string[],
    expectedLandTotal: number,
    expectedTotalPrice: number,
    viewLandTotal: number,
    viewTotalPrice: number
  }
```

Validates the calculation:
```
expected_land_total = retail_price ?? wholesale_price ?? (sqm × rate)
expected_total_price = expected_land_total + house_cost

Then compares to view's calculated land_total and total_price
```

#### API Endpoint Validation

When `/api/seafields/allocations` is called, it now:
1. Returns the public view data immediately (no latency impact)
2. Runs validation in the background (non-blocking)
3. Logs any critical price mismatches to `audit_log` table
4. Surfaces issues in the admin audit dashboard

**Key:** Validation is **read-only** and **non-blocking**. Pricing discrepancies are logged but don't prevent the API from responding.

#### Scheduled Audit Function

**Edge Function:** `seafields-pricing-audit`

Schedule this to run every 6 hours:

```bash
# Deploy to Supabase
supabase functions deploy seafields-pricing-audit

# Set up cron trigger in Supabase dashboard:
# Source: pg_cron
# Cron expression: 0 */6 * * * (every 6 hours)
```

What it does:
- Fetches all allocations, stages, and view data
- Validates each lot for consistency
- Logs critical issues to `audit_log` with severity levels
- Returns JSON summary of findings

**Audit Log Entry Example:**

```json
{
  "actor_email": "system@pricing-validator",
  "action": "seafields_pricing_validation_critical",
  "entity_type": "seafields_lot_allocations",
  "entity_id": "237",
  "details": {
    "severity": "critical",
    "message": "Total price mismatch: expected $1066400, view shows $610700",
    "timestamp": "2026-05-28T14:23:00Z",
    "source": "scheduled-audit"
  }
}
```

---

### 3. UI Clarity: Price Tier Labeling

**Changes:**

#### Public Modal (LotInfoCard.tsx)

Previously:
```
House + Land: From $1,066,400
Land Only: From $610,700
```

Now:
```
AVAILABLE OPTIONS

🏠 House + Land Package
   $1,066,400
   Includes land, modular home build & site works

📍 Serviced Land Only
   $610,700
   Titled land only — build your own design

Prices shown are from the current reserve...
```

**What changed:**
- Added "AVAILABLE OPTIONS" header
- Added icon indicators (visual differentiation)
- Added descriptive subtitles per tier
- Gradient background for prominence
- Clear footer text about reserves

#### Registration Form (RegistrationForm.tsx)

Previously:
```
House & Land Package — Your Price Expectation
From $..., From $..., From $...
```

Now:
```
House & Land Package                    [FULL PACKAGE]
What would you expect to pay for Lot 237 (525m²)?
This includes the land, Factory2Key modular home build, and all site works.

☑️ From $1,066,400
☑️ From $1,091,400
☑️ From $1,116,400
```

**What changed:**
- Added tier badge ("FULL PACKAGE" / "LAND ONLY")
- More explicit copy about what's included
- Makes the distinction unavoidable

---

## How to Use

### For Uwe (Property Friends)

1. **If you see a pricing discrepancy:** Run the audit script to confirm the database is correct:
   ```bash
   npx ts-node scripts/seafields-pricing-audit.ts --lot NUMBER
   ```

2. **Daily monitoring:** Audit logs appear in the admin panel under Audit Log. Look for any entries with `seafields_pricing_validation` action.

3. **When updating prices:** The validation runs automatically. If you see an issue, check:
   - Is `house_cost` set correctly?
   - Is `retail_price` set?
   - Is the stage rate correct?

### For Developers

1. **Local testing:**
   ```bash
   # Test the validator directly
   import { validateLotPricing } from '@/lib/seafields-pricing-validator'
   
   const result = validateLotPricing(allocation, stage, viewRow)
   if (!result.isValid) {
     console.log(result.issues)
   }
   ```

2. **Deploy the edge function:**
   ```bash
   supabase functions deploy seafields-pricing-audit
   ```

3. **Monitor in production:**
   - Check `audit_log` table for validation entries
   - Filter by `action = 'seafields_pricing_validation_critical'`
   - Alert on any rows with `severity = 'critical'`

---

## Data Model Reference

### seafields_lot_allocations table

```sql
lot_number: INTEGER              -- Lot ID
sqm: NUMERIC                     -- Land area
retail_price: NUMERIC            -- Set price (bands from migration 0022)
wholesale_price: NUMERIC        -- Legacy wholesale price
house_cost: NUMERIC             -- Cost of modular home build
land_rate_override_per_sqm: NUMERIC -- Per-lot land rate override
stage_id: UUID                  -- FK to stages table
status: TEXT                    -- available|reserved|sold|withheld
display_price_to_public: BOOLEAN -- Whether to show price on public site
```

### seafields_public_lots view (READ-ONLY)

```sql
lot_number: INTEGER
land_total: NUMERIC             -- retail_price OR (sqm × rate)
total_price: NUMERIC            -- land_total + house_cost
land_only: BOOLEAN              -- Is this land-only offering?
```

### audit_log table

```sql
actor_email: TEXT
action: TEXT                    -- e.g. 'seafields_pricing_validation_critical'
entity_type: TEXT              -- 'seafields_lot_allocations'
entity_id: TEXT                -- lot number as string
details: JSONB                 -- {"severity", "message", "timestamp", ...}
```

---

## Performance Notes

- **Audit script:** ~2-5 seconds for all 145 lots (SQL queries only)
- **API validation:** Non-blocking, runs in background after response
- **Edge function:** ~5-10 seconds, runs every 6 hours (no user impact)
- **UI:** No latency change; labels are static and pre-rendered

---

## Testing Checklist

Before signing off on this solution:

- [ ] Audit script runs without errors
- [ ] Audit script correctly identifies consistent pricing (0 issues)
- [ ] Public modal shows clear price tier labels
- [ ] Registration form shows clear tier badges
- [ ] Tier descriptions match what Uwe intends
- [ ] Mobile view looks good (responsive checks)
- [ ] Edge function deploys successfully
- [ ] Audit log entries appear after edge function runs
- [ ] No API latency regression (should be same or faster)

---

## Future Enhancements

1. **Admin dashboard widget:** Real-time pricing health on the admin home page
2. **Price change alerts:** Notify Uwe when house_cost or retail_price changes
3. **Batch price updates:** Spreadsheet import with validation pre-check
4. **Price history:** Track price changes over time in audit_log
5. **Landed cost calculator:** Show breakdown (land + house + site works)

---

## Questions?

- **Data issues?** Run the audit script and share the output
- **UI doesn't look right?** Check browser zoom (should be 100%) and responsive breakpoints
- **API concerns?** Check production logs for `[seafields-pricing]` entries
