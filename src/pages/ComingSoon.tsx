import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowRight } from "lucide-react";

const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate email capture (you can connect this to your backend later)
    setTimeout(() => {
      toast.success("Thanks! We'll notify you when we launch.");
      setEmail("");
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-2 shadow-xl">
        <CardContent className="pt-12 pb-12 px-8 text-center space-y-8">
          {/* Logo */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Recouply.ai
            </h1>
            <p className="text-2xl font-semibold text-foreground">
              AI-Powered Invoice Collection
            </p>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-primary">Private Beta</span>
          </div>

          {/* Main Message */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              Coming Soon
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              The AI Collections Command Center is launching soon. Get early access and transform how you collect overdue invoices.
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="font-semibold text-foreground">AI Personas</h3>
              <p className="text-sm text-muted-foreground">Smart agents handle every aging bucket</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold text-foreground">Automated Workflows</h3>
              <p className="text-sm text-muted-foreground">Set it and forget it collections</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-foreground">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">Track every response and outcome</p>
            </div>
          </div>

          {/* Waitlist Form */}
          <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg">
                {loading ? "Joining..." : "Request Access"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Join the waitlist to get early access and exclusive launch benefits
            </p>
          </form>

        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;
