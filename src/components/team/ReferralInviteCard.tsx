import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Gift, Mail, Linkedin, Copy, Check, Sparkles, Send } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { useSubscription } from "@/hooks/useSubscription";

const PLAN_CREDITS: Record<string, number> = {
  solo_pro: 20,
  starter: 50,
  growth: 75,
  pro: 100,
  professional: 100,
  enterprise: 0,
};

export function ReferralInviteCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const { referrals, referralCode, availableCredits, sendEmailInvite, generateShareLink } = useReferrals();
  const { plan } = useSubscription();

  const creditsPerReferral = PLAN_CREDITS[plan] || 0;
  const isEnterprise = plan === "enterprise";
  const completedReferrals = referrals.filter(r => r.status === "completed").length;
  const pendingReferrals = referrals.filter(r => r.status === "pending" && r.referred_email).length;

  const handleSendEmail = async () => {
    if (!email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSending(true);
    const result = await sendEmailInvite(email);
    setSending(false);

    if (result === 'already_exists') {
      toast.error("This email is already registered on Recouply.ai");
    } else if (result) {
      toast.success(`Referral invite sent to ${email}`);
      setEmail("");
    } else {
      toast.error("Failed to send invite. Please try again.");
    }
  };

  const handleCopyLink = async () => {
    const link = generateShareLink();
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkedInShare = () => {
    const link = generateShareLink();
    const shareText = `💸 Stripe + Recouply.ai = set it and forget it collections.

If you run on Stripe, you already know invoices go out automatically — but chasing the unpaid ones still eats your week.

Recouply.ai is the Collections & Risk Intelligence Platform that plugs straight into Stripe and:
✅ Auto-syncs every invoice & payment in real time
✅ Sends AI-powered, on-brand follow-ups so nothing slips
✅ Scores customer credit & payment risk before it hurts cash flow
✅ Gives clients a secure payment portal to pay in one click

💼 Pricing built for everyone — from solo operators to enterprise finance teams.

Truly set it and forget it AR. Try it here 👇
${link}

(We both earn bonus credits when you sign up 🚀) #AccountsReceivable #Stripe #Fintech #AI`;
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/5">
          <Gift className="h-4 w-4 text-primary" />
          Invite & Earn Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Invite Friends & Earn Credits
          </DialogTitle>
        </DialogHeader>

        {/* Reward Banner */}
        <div className="rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isEnterprise ? "Custom Rewards" : `Earn ${creditsPerReferral} bonus invoice credits`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEnterprise 
                  ? "Contact your account manager for custom referral rewards" 
                  : "Per successful referral • Valid for 1 year"}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold">
              {plan.replace("_", " ").toUpperCase()} Plan
            </Badge>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-muted">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{availableCredits}</p>
              <p className="text-[10px] text-muted-foreground">Available Credits</p>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{completedReferrals}</p>
              <p className="text-[10px] text-muted-foreground">Successful</p>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-muted-foreground">{pendingReferrals}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Email Invite */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Invite via Email
          </Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
              className="flex-1"
            />
            <Button onClick={handleSendEmail} disabled={sending || !email.trim()} size="sm" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>

        {/* Social Share */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Share Your Link</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleLinkedInShare}
            >
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              Share on LinkedIn
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>

        {/* Referral Code Display */}
        {referralCode && (
          <div className="rounded-md bg-muted/50 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Referral Code</p>
              <p className="text-sm font-mono font-semibold text-foreground">{referralCode}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyLink}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* How it works */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">How it works</p>
          <div className="space-y-1.5">
            {[
              "Share your referral link or send an email invite",
              "Your friend signs up and subscribes to a paid plan",
              `You earn ${isEnterprise ? "custom" : creditsPerReferral} bonus credits, valid for 1 year`,
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
