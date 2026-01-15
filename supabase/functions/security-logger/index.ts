import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SecurityLogEntry {
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
  email?: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const body = await req.json() as SecurityLogEntry;
    const { event_type, ip_address, user_agent: bodyUserAgent, user_id, email, details } = body;

    // Insert security log
    const { error: insertError } = await supabase.from("security_logs").insert({
      event_type,
      ip_address: ip_address || clientIp,
      user_agent: bodyUserAgent || userAgent,
      user_id,
      email,
      details,
    });

    if (insertError) {
      console.error("Error inserting security log:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Security logger error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
