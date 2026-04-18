import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AITemplateContextCard() {
  const { data: context, isLoading } = useQuery({
    queryKey: ["ai-template-context"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;

      const { data, error } = await supabase
        .from("branding_settings")
        .select("industry, business_description, business_name")
        .eq("user_id", accountId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as { industry: string | null; business_description: string | null; business_name: string } | null;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  const hasContext = context?.industry && context?.business_description;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          AI Template Context
        </CardTitle>
        <CardDescription>Business context used to generate outreach templates</CardDescription>
      </CardHeader>
      <CardContent>
        {hasContext ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{context.business_name}</span>
              <Badge variant="secondary" className="text-[10px]">{context.industry}</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {context.business_description}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <p>
              No industry context configured yet. Click <strong>"Generate Templates"</strong> above to provide your business details — this helps AI agents craft outreach that references your products and services naturally.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
