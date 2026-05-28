# Seafields Pricing — Quick Reference for Uwe

## Problem Solved ✅

**Issue:** Lot 237 showed $1,066,400 in one place and $610,700 in another  
**Cause:** Two different price tiers weren't clearly labeled  
**Solution:** Enhanced UI labels + monitoring system

---

## What You See Now

### On the Public Site Map (hover on a lot)

```
Lot 237

🏠 HOUSE + LAND PACKAGE
   $1,066,400
   Includes land, modular home build & site works

📍 SERVICED LAND ONLY
   $610,700
   Titled land only — build your own design
```

**Clear.** No confusion.

### In the Registration Form

When you select an interest type:

```
House & Land Package                    [FULL PACKAGE]
What would you expect to pay for Lot 237 (525m²)?
This includes the land, Factory2Key modular home build, and all site works.

☑️ From $1,066,400
☑️ From $1,091,400
☑️ From $1,116,400
```

---

## How It's Monitored

### Daily Check (You Don't Need to Do This)

Behind the scenes, we check every 6 hours:
- Database values match what the public site shows
- No pricing discrepancies between the two
- Any issues go to the Audit Log (admin panel)

### If Something Goes Wrong

You'll see an audit log entry like:

```
Action: seafields_pricing_validation_critical
Lot: 237
Issue: "Total price mismatch: expected $1,066,400, view shows $610,700"
```

---

## If You Need to Debug

### Run the Audit Script

From the command line:

```bash
npx ts-node scripts/seafields-pricing-audit.ts --lot 237
```

**Output:**
```
✅ All prices consistent!

or

❌ ISSUES FOUND:

Lot 237 (525m²)
  Status: available
  Retail price: $155,000
  House cost: $911,400
  Expected land: $155,000
  Expected total: $1,066,400
  View shows land: $155,000
  View shows total: $1,066,400
  ✅ All good!
```

---

## The Three Prices (Why They Exist)

Every lot has up to three prices stored:

| Price | What It Is | Example (Lot 237) |
|-------|-----------|------------------|
| **Land Price** | Just the land | $155,000 |
| **House Cost** | Modular home build | $911,400 |
| **Total (H&L)** | Land + house | $1,066,400 |

**Why?** So registrants can choose:
- Land only: $155,000 → "I'll build my own design"
- Land + house: $1,066,400 → "Build it for me"

---

## If You Change a Price

### How to Update

You do this in the admin panel (Lots page):

1. Find Lot 237
2. Click edit
3. Change the price field
4. Save

### What Happens Automatically

1. Database updates
2. Validation runs (checks it looks right)
3. Public site refreshes within 60 seconds
4. Both the map and form show the new price

**No manual sync needed.** Everything stays in sync.

---

## Data Flow (Behind the Scenes)

```
Database (seafields_lot_allocations)
    ↓
    ├─ Reading public view (instantaneous)
    ├─ Validation checks (non-blocking, runs async)
    └─ Audit logging (if issues found)
    ↓
API (/api/seafields/allocations)
    ↓
    ├─ Public site map modal
    └─ Registration form
```

**Key:** Validation doesn't slow anything down. It runs after the API response is sent.

---

## Contact

- **Questions about prices?** Check the Audit Log (admin panel)
- **Something looks wrong?** Run the audit script and send the output
- **Need to change a price?** Do it in the Lots admin page; no manual refresh needed

---

## Reference Links

- **Full docs:** `docs/SEAFIELDS_PRICING_SOLUTION.md`
- **Audit script:** `scripts/seafields-pricing-audit.ts`
- **Validator:** `src/lib/seafields-pricing-validator.ts`
- **UI changes:** `src/components/seafields/LotInfoCard.tsx` + `RegistrationForm.tsx`
