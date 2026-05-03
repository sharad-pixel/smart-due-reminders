import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

const SupportVerify = () => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const e = sessionStorage.getItem("recouply.support_login_email") ?? "";
    setEmail(e);
    if (!e) navigate("/support/login");
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { toast.error("Enter the 6-digit code"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("support-login-verify", {
      body: {
        email,
        code,
        redirectTo: `${window.location.origin}/admin/support-access`,
      },
    });
    setSubmitting(false);
    if (error || !data?.action_link) {
      toast.error(error?.message || "Invalid or expired code");
      return;
    }
    sessionStorage.removeItem("recouply.support_login_email");
    // Navigate to the magic link — Supabase will set the session and bounce to redirectTo.
    window.location.href = data.action_link;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-lg bg-primary/10 p-3 w-fit mb-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Enter Your Code</CardTitle>
          <CardDescription>
            Sent to <strong>{email}</strong>. Expires in 5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              className="text-center text-xl tracking-[0.5em]"
            />
            <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
              {submitting ? "Verifying…" : "Verify & sign in"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/support/login")}>
              Use a different email
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportVerify;
