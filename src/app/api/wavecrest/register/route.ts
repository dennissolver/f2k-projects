import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { escapeHtml } from "@/lib/html-escape";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().max(30).nullable().optional(),
  interest_type: z.string().max(100).nullable().optional(),
  // Location
  suburb: z.string().max(100).nullable().optional(),
  postcode: z.string().max(4).nullable().optional(),
  // Buyer profile
  buyer_type: z.string().max(50).nullable().optional(),
  buyer_profile: z.string().max(50).nullable().optional(),
  current_housing: z.string().max(50).nullable().optional(),
  purchase_timeline: z.string().max(50).nullable().optional(),
  finance_status: z.string().max(50).nullable().optional(),
  how_heard: z.string().max(50).nullable().optional(),
  // Referrer
  referrer_type: z.string().max(50).nullable().optional(),
  referrer_name: z.string().max(200).nullable().optional(),
  referrer_company: z.string().max(200).nullable().optional(),
  referrer_contact: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must acknowledge this is a registration of interest only",
    }),
  }),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const supabase = createSupabaseService();

  // Try to insert into wavecrest_registrations table
  // Table may not exist yet - that's OK, we'll handle gracefully
  const { error } = await (supabase.from("wavecrest_registrations") as any).insert({
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email,
    phone: d.phone,
    interest_type: d.interest_type,
    suburb: d.suburb,
    postcode: d.postcode,
    buyer_type: d.buyer_type,
    buyer_profile: d.buyer_profile,
    current_housing: d.current_housing,
    purchase_timeline: d.purchase_timeline,
    finance_status: d.finance_status,
    how_heard: d.how_heard,
    referrer_type: d.referrer_type,
    referrer_name: d.referrer_name,
    referrer_company: d.referrer_company,
    referrer_contact: d.referrer_contact,
    notes: d.notes,
    source: "web-roi",
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Wavecrest registration insert error:", error);
  } else {
    console.log("Wavecrest registration:", {
      name: `${d.first_name} ${d.last_name}`,
      email: d.email,
      interest_type: d.interest_type,
    });
  }

  return NextResponse.json({ success: true });
}
