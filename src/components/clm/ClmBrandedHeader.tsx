import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Building2 } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  rightSlot?: React.ReactNode;
}

/**
 * Branded header used on CLM template & workspace pages.
 * Pulls account-level branding (logo, colors, business_name) from branding_settings.
 */
export const ClmBrandedHeader = ({ title, subtitle, meta, rightSlot }: Props) => {
  const { accountId } = useClmEntitlement();

  const { data: branding } = useQuery({
    queryKey: ["clm-branding", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("branding_settings")
        .select("business_name, logo_url, primary_color, accent_color")
        .eq("user_id", accountId!)
        .maybeSingle();
      return data;
    },
  });

  const primary = branding?.primary_color || "hsl(var(--primary))";
  const accent = branding?.accent_color || "hsl(var(--accent))";

  return (
    <div
      className="rounded-lg border mb-6 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primary}10, ${accent}10)`, borderColor: `${primary}30` }}
    >
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3 min-w-0">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.business_name ?? "Business logo"}
              className="h-12 w-auto max-w-[160px] object-contain rounded bg-background/60 p-1 border"
            />
          ) : (
            <div
              className="h-12 w-12 rounded flex items-center justify-center text-white font-semibold text-sm shrink-0"
              style={{ background: primary }}
            >
              {(branding?.business_name ?? "C").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            {branding?.business_name && (
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: primary }}>
                <Building2 className="h-3 w-3 inline mr-1" />
                {branding.business_name}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            {meta && <p className="text-xs text-muted-foreground mt-1">{meta}</p>}
          </div>
        </div>
        {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
      </div>
    </div>
  );
};
