import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHALLENGES = [
  "Quote-to-Cash", "Deal Desk", "Contracts", "Billing", "Collections", "Cash Application",
  "Revenue Operations", "Systems Integration", "O2C Transformation", "Other",
];
const LOOKING_FOR = ["O2C Assessment", "O2C Transformation", "Custom Business Application", "Collections", "Billing Transformation", "Deal Desk", "Revenue Operations", "AI Workflow Automation", "Other"];
const HANDLED = ["Spreadsheet", "Email", "Existing enterprise software", "Manual workflow", "Multiple systems", "Custom internal tool", "Other"];
const SIZES = ["1-50", "51-200", "201-1,000", "1,001-5,000", "5,000+"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid work email").max(255),
  company: z.string().trim().min(1, "Company is required").max(150),
  title: z.string().trim().max(100).optional(),
  size: z.string().max(30).optional(),
  erp: z.string().trim().max(100).optional(),
  crm: z.string().trim().max(100).optional(),
  billing: z.string().trim().max(100).optional(),
  lookingFor: z.string().min(1, "Choose what you are looking for"),
  handled: z.string().max(60).optional(),
  challenge: z.string().max(60).optional(),
  details: z.string().trim().max(2000).optional(),
});

export default function O2CLeadForm() {
  const [f, setF] = useState({ name: "", email: "", company: "", title: "", size: "", erp: "", crm: "", billing: "", challenge: "", details: "", lookingFor: "", handled: "" });
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) { setDone(true); return; }
    const parsed = schema.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const d = parsed.data;
    setLoading(true);
    const message = `[${d.lookingFor}] Looking for: ${d.lookingFor} | Handled today: ${d.handled || "-"} | Challenge: ${d.challenge || "-"} | Title: ${d.title || "-"} | ERP: ${d.erp || "-"} | CRM: ${d.crm || "-"}\n\n${d.details || ""}`;
    const { error } = await supabase.from("contact_requests").insert([{
      name: d.name, email: d.email, company: d.company,
      billing_system: d.billing || null, team_size: d.size || null, message,
    }]);
    if (error) { setLoading(false); toast.error("Couldn't submit. Please try again."); return; }
    supabase.functions.invoke("send-admin-alert", {
      body: { type: "contact_request", email: d.email, name: d.name, company: d.company, message, intent: d.lookingFor === "Custom Business Application" ? "Custom Business Application" : "O2C Transformation Assessment", billingSystem: d.billing, teamSize: d.size },
    }).catch(() => {});
    setLoading(false);
    setDone(true);
    toast.success("Thanks — we'll be in touch about your request.");
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <h3 className="text-2xl font-semibold">Request received</h3>
        <p className="mt-3 text-muted-foreground">We'll reach out to schedule a conversation about your use case.</p>
      </div>
    );
  }

  const field = (k: keyof typeof f, label: string, type = "text", req = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`o2c-${k}`}>{label}{req && " *"}</Label>
      <Input id={`o2c-${k}`} type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} required={req} />
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 sm:p-8 grid gap-4 sm:grid-cols-2">
      <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" />
      {field("name", "Name", "text", true)}
      {field("email", "Work Email", "email", true)}
      {field("company", "Company", "text", true)}
      {field("title", "Job Title")}
      <div className="space-y-1.5">
        <Label>Company Size</Label>
        <Select value={f.size} onValueChange={set("size")}>
          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
          <SelectContent>{SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {field("erp", "Current ERP")}
      {field("crm", "Current CRM")}
      {field("billing", "Billing Platform")}
      <div className="space-y-1.5">
        <Label>What are you looking for? *</Label>
        <Select value={f.lookingFor} onValueChange={set("lookingFor")}>
          <SelectTrigger><SelectValue placeholder="Select one" /></SelectTrigger>
          <SelectContent>{LOOKING_FOR.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>How is this handled today?</Label>
        <Select value={f.handled} onValueChange={set("handled")}>
          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
          <SelectContent>{HANDLED.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Primary O2C Challenge</Label>
        <Select value={f.challenge} onValueChange={set("challenge")}>
          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
          <SelectContent>{CHALLENGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="o2c-details">Describe the process or use case</Label>
        <Textarea id="o2c-details" rows={4} value={f.details} onChange={(e) => set("details")(e.target.value)} placeholder="Tell us what your team does today, what systems are involved, and what you would like to improve." />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Submitting…" : "Discuss My Use Case"}
        </Button>
      </div>
    </form>
  );
}
