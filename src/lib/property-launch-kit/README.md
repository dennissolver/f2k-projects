# property-launch-kit

In-repo shared primitives for property-sale launch pages (Seafields,
Branscombe, any future estate).

## What's here

| Module | Purpose |
|---|---|
| `branded-email.ts` | Generic `renderBrandedEmail({ args, branding })` for admin notifications. Centralises the F2K-style HTML shell shared across products. |
| `notify-recipients.ts` | Generic `getActiveRecipients({ table, fallback })` reading from any `{product}_notify_recipients` table. |
| `index.ts` | Barrel re-export of the public surface. |

## How products consume it

Each product has a thin shim in `src/lib/{product}/notify.ts` that
pre-fills branding + the table name. Callers import from the product
shim, not from the launch-kit directly, so existing code keeps working.

Example: `src/lib/seafields/notify.ts` →
```ts
const BRANDING: Branding = {
  productName: "Seafields Estate",
  adminUrl: "https://f2k-projects.vercel.app/admin/seafields-registrations",
};

export async function getActiveRecipients() {
  return getActiveRecipientsShared({
    table: "seafields_notify_recipients",
    fallback: [...],
  });
}

export function renderBrandedEmail(args: RenderArgs) {
  return renderBrandedEmailShared(args, BRANDING);
}
```

## Components

Related shared UI components live at:
- `src/components/admin/NotifyRecipientsCard.tsx` — recipient-list editor (parameterised by `apiEndpoint`)
- `src/components/property/DesignGallery.tsx` — home-designs grid with click-to-expand lightbox

These should move into this directory when this kit is lifted to a
published package.

## Future path

Lift to `cais-shared-services/packages/property-launch-kit/` and
publish as `@caistech/property-launch-kit` when a third property
comes online (N=3 makes the npm-package overhead worth it). At that
point this directory becomes the package source, the per-product
shims update their imports to `@caistech/property-launch-kit`, and
the shared components above move under `packages/property-launch-kit/components/`.

Per the CLAUDE.md `@caistech` SHARED-SERVICES FIRST RULE, the package
will get an entry in the hub manifest at that time.
