import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for every client component.
 *
 * flowType MUST be "implicit". signInWithOtp / resetPasswordForEmail / email
 * confirmations all mint a token that lands in the Supabase email template's
 * {{ .TokenHash }}, which `/api/auth/confirm` verifies server-side with
 * verifyOtp({ token_hash }). Under the default PKCE flow that token is
 * `pkce_`-prefixed and can only be completed by exchangeCodeForSession with the
 * originating browser's verifier — so verifyOtp rejects it and EVERY magic-link
 * / recovery / confirmation link dies with "Email link is invalid or has
 * expired" (confirmed 2026-05-27, admin + agent, any device). Implicit flow
 * mints a plain token_hash that verifyOtp accepts device-independently, which is
 * exactly what the confirm route is built for. Password login is unaffected by
 * flowType.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } },
  );
}
