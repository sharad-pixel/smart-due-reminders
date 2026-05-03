import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

const SupportLogin = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("support-login-request", {
      body: { email: email.trim().toLowerCase() },
    });
    setSubmitting(false);
    if (error) { toast.error("Could not send code"); return; }
    sessionStorage.setItem("recouply.support_login_email", email.trim().toLowerCase());
    const next = searchParams.get("next");
    if (next?.startsWith("/")) sessionStorage.setItem("recouply.support_login_next", next);
    toast.success("If your email is authorized, a 6-digit code is on its way.");
    navigate("/support/verify");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-lg bg-primary/10 p-3 w-fit mb-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Recouply Support Login</CardTitle>
          <CardDescription>Enter your support email to receive a 6-digit code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@recouply.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportLogin;
