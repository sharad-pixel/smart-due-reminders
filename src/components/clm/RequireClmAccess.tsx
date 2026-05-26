import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSignature, Lock, Loader2 } from "lucide-react";

export const RequireClmAccess = ({ children }: { children: ReactNode }) => {
  const { isActive, isLoading } = useClmEntitlement();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <FileSignature className="h-5 w-5" /> Contract Intelligence
            </CardTitle>
            <CardDescription>
              The Contract Intelligence module is a separately purchased Recouply.ai add-on.
              Contact our team to enable Contract Intelligence for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link to="/contact-us?topic=clm">Talk to sales</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/clm">Learn about Contract Intelligence →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
