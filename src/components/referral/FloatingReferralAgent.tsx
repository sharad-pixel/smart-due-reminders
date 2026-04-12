import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Gift, Mail, Linkedin, Copy, Check, Sparkles, Send, X, ChevronDown } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { useSubscription } from "@/hooks/useSubscription";
import { motion, AnimatePresence } from "framer-motion";

import jamesAvatar from "@/assets/personas/james.png";
import katyAvatar from "@/assets/personas/katy.png";
import samAvatar from "@/assets/personas/sam.png";
import troyAvatar from "@/assets/personas/troy.png";

const AGENTS = [
  { name: "James", avatar: jamesAvatar, tone: "professional", greeting: "Hey there! 👋 Know someone who'd benefit from smarter collections? Refer them and earn bonus credits!" },
  { name: "Katy", avatar: katyAvatar, tone: "friendly", greeting: "Hi! 😊 Love using Recouply? Share it with a colleague and you'll both win — you get bonus invoice credits!" },
  { name: "Sam", avatar: samAvatar, tone: "casual", greeting: "Yo! 🎉 Spread the word about Recouply and stack up free invoice credits. It's a win-win!" },
  { name: "Troy", avatar: troyAvatar, tone: "direct", greeting: "Quick heads up — every referral earns you bonus credits. Want to invite someone?" },
];

const PLAN_CREDITS: Record<string, number> = {
  solo_pro: 20,
  starter: 50,
  growth: 75,
  pro: 100,
  professional: 100,
  enterprise: 0,
};

export function FloatingReferralAgent() {
  const [minimized, setMinimized] = useState(() => {
    return sessionStorage.getItem("referral-agent-minimized") === "true";
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  const { referrals, referralCode, availableCredits, sendEmailInvite, generateShareLink } = useReferrals();
  const { plan } = useSubscription();

  const agent = useMemo(() => AGENTS[Math.floor(Math.random() * AGENTS.length)], []);

  const creditsPerReferral = PLAN_CREDITS[plan] || 0;
  const isEnterprise = plan === "enterprise";
  const completedReferrals = referrals.filter(r => r.status === "completed").length;
  const pendingReferrals = referrals.filter(r => r.status === "pending" && r.referred_email).length;

  useEffect(() => {
    if (!minimized) {
      const timer = setTimeout(() => setShowBubble(true), 2000);
      return () => clearTimeout(timer);
    }
    setShowBubble(false);
  }, [minimized]);

  const handleMinimize = () => {
    setMinimized(true);
    setShowBubble(false);
    sessionStorage.setItem("referral-agent-minimized", "true");
  };

  const handleRestore = () => {
    setMinimized(false);
    sessionStorage.removeItem("referral-agent-minimized");
  };

  const handleSendEmail = async () => {
    if (!email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSending(true);
    const success = await sendEmailInvite(email);
    setSending(false);
    if (success) {
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
    const text = `I've been using Recouply.ai to automate collections and it's been a game-changer. Check it out and we both earn bonus credits! 🎉`;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}&summary=${encodeURIComponent(text)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  // Minimized state — small gift icon
  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow group"
        onClick={handleRestore}
        title="Referral rewards"
      >
        <Gift className="h-5 w-5 text-primary-foreground group-hover:scale-110 transition-transform" />
        {availableCredits > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {availableCredits}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <>
      {/* Floating agent bubble */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Speech bubble */}
        <AnimatePresence>
          {showBubble && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="max-w-[260px] rounded-xl bg-card border shadow-xl p-3 relative"
            >
              <button
                onClick={handleMinimize}
                className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="text-xs text-foreground leading-relaxed pr-4">{agent.greeting}</p>
              <Button
                size="sm"
                className="mt-2 w-full gap-1.5 text-xs"
                onClick={() => { setModalOpen(true); setShowBubble(false); }}
              >
                <Gift className="h-3.5 w-3.5" />
                Invite & Earn
              </Button>
              {/* Arrow pointing to avatar */}
              <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-card" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent avatar */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (showBubble) {
              setModalOpen(true);
              setShowBubble(false);
            } else {
              setShowBubble(true);
            }
          }}
          className="relative h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow ring-2 ring-primary/30 ring-offset-2 ring-offset-background overflow-hidden"
        >
          <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent h-5 flex items-end justify-center pb-0.5">
            <span className="text-[8px] font-bold text-white tracking-wide uppercase">{agent.name}</span>
          </div>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/20 pointer-events-none" style={{ animationDuration: "3s" }} />
        </motion.button>

        {/* Minimize button */}
        <button
          onClick={handleMinimize}
          className="h-6 w-6 rounded-full bg-muted border flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
          title="Minimize"
        >
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* Referral Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Invite Friends & Earn Credits
            </DialogTitle>
          </DialogHeader>

          {/* Agent intro */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 border p-3">
            <img src={agent.avatar} alt={agent.name} className="h-10 w-10 rounded-full object-cover ring-1 ring-primary/20" />
            <div>
              <p className="text-sm font-semibold text-foreground">{agent.name} says:</p>
              <p className="text-xs text-muted-foreground">{agent.greeting}</p>
            </div>
          </div>

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

          {/* Stats */}
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
              <Button variant="outline" className="flex-1 gap-2" onClick={handleLinkedInShare}>
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                Share on LinkedIn
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyLink}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>

          {/* Referral Code */}
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
    </>
  );
}
