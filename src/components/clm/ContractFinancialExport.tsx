import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileText, FileSpreadsheet, Mail, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface Totals {
  mrr: number;
  arr: number;
  acv: number;
  tcv: number;
  scheduled: number;
  recurringTcv?: number;
  servicesTcv?: number;
  oneTimeTcv?: number;
  termMonths?: number;
  currency?: string;
  source?: string;
  warnings?: string[];
}

interface Props {
  contractName: string;
  customerName?: string | null;
  totals: Totals;
}

const buildPdf = ({ contractName, customerName, totals }: Props): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = margin;
  const currency = totals.currency || "USD";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("Contract Financial Summary", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(contractName, margin, y);
  y += 14;
  if (customerName) {
    doc.text(customerName, margin, y);
    y += 14;
  }
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 18;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["MRR", formatCurrency(totals.mrr, currency)],
      ["ARR", formatCurrency(totals.arr, currency)],
      ["ACV", formatCurrency(totals.acv, currency)],
      [totals.tcv > 0 ? "TCV" : "Scheduled", formatCurrency(totals.tcv > 0 ? totals.tcv : totals.scheduled, currency)],
      ["Recurring TCV", formatCurrency(totals.recurringTcv || 0, currency)],
      ["Services TCV", formatCurrency(totals.servicesTcv || 0, currency)],
      ["One-time TCV", formatCurrency(totals.oneTimeTcv || 0, currency)],
      ["Term", totals.termMonths ? `${Math.round(totals.termMonths)} months` : "—"],
      ["Currency", currency],
      ["Source", String(totals.source || "—").replace(/_/g, " ")],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
    margin: { left: margin, right: margin },
  });

  const warnings = totals.warnings || [];
  if (warnings.length > 0) {
    const afterTable = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9);
    doc.text("Review recommended", margin, afterTable);
    autoTable(doc, {
      startY: afterTable + 8,
      body: warnings.map((w) => [w]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 4, textColor: [120, 53, 15] },
      margin: { left: margin, right: margin },
    });
  }
  return doc;
};

const buildCsv = ({ contractName, customerName, totals }: Props): string => {
  const currency = totals.currency || "USD";
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: string[][] = [
    ["Contract", contractName],
    ["Customer", customerName || ""],
    ["Generated", new Date().toISOString()],
    [],
    ["Metric", "Value", "Currency"],
    ["MRR", String(totals.mrr ?? 0), currency],
    ["ARR", String(totals.arr ?? 0), currency],
    ["ACV", String(totals.acv ?? 0), currency],
    ["TCV", String(totals.tcv ?? 0), currency],
    ["Scheduled total", String(totals.scheduled ?? 0), currency],
    ["Recurring TCV", String(totals.recurringTcv ?? 0), currency],
    ["Services TCV", String(totals.servicesTcv ?? 0), currency],
    ["One-time TCV", String(totals.oneTimeTcv ?? 0), currency],
    ["Term (months)", String(totals.termMonths ?? "")],
    ["Source", String(totals.source ?? "")],
  ];
  if (totals.warnings && totals.warnings.length) {
    rows.push([], ["Warnings"]);
    totals.warnings.forEach((w) => rows.push([w]));
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
};

const sanitize = (s: string) =>
  s.replace(/[^a-z0-9\-_]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "contract";

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const ContractFinancialExport = (props: Props) => {
  const { contractName, customerName, totals } = props;
  const [emailOpen, setEmailOpen] = useState(false);
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState(`Financial Summary — ${contractName}`);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const baseFile = useMemo(() => sanitize(contractName) + "-financial-summary", [contractName]);

  const downloadPdf = () => {
    try {
      const doc = buildPdf(props);
      doc.save(`${baseFile}.pdf`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    }
  };

  const downloadCsv = () => {
    try {
      const csv = buildCsv(props);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseFile}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate CSV");
    }
  };

  const openEmail = (f: "pdf" | "csv") => {
    setFormat(f);
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    const list = recipients
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }
    const bad = list.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad) {
      toast.error(`Invalid email: ${bad}`);
      return;
    }
    setSending(true);
    try {
      let attachment;
      if (format === "pdf") {
        const doc = buildPdf(props);
        const buf = doc.output("arraybuffer");
        attachment = {
          filename: `${baseFile}.pdf`,
          content: arrayBufferToBase64(buf),
          type: "application/pdf",
        };
      } else {
        const csv = buildCsv(props);
        attachment = {
          filename: `${baseFile}.csv`,
          content: btoa(unescape(encodeURIComponent(csv))),
          type: "text/csv",
        };
      }

      const currency = totals.currency || "USD";
      const html = `
        <div style="font-family: -apple-system, system-ui, sans-serif; color:#1e293b; max-width:600px;">
          <h2 style="margin:0 0 8px;">Contract Financial Summary</h2>
          <div style="color:#64748b; font-size:14px; margin-bottom:16px;">
            ${contractName}${customerName ? ` · ${customerName}` : ""}
          </div>
          ${note ? `<p style="white-space:pre-wrap; border-left:3px solid #3B82F6; padding:8px 12px; background:#f8fafc;">${note.replace(/</g, "&lt;")}</p>` : ""}
          <table style="border-collapse:collapse; width:100%; font-size:14px; border:1px solid #e2e8f0;">
            <tbody>
              <tr><td style="padding:8px 12px; border:1px solid #e2e8f0; font-weight:600;">MRR</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${formatCurrency(totals.mrr, currency)}</td></tr>
              <tr><td style="padding:8px 12px; border:1px solid #e2e8f0; font-weight:600;">ARR</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${formatCurrency(totals.arr, currency)}</td></tr>
              <tr><td style="padding:8px 12px; border:1px solid #e2e8f0; font-weight:600;">ACV</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${formatCurrency(totals.acv, currency)}</td></tr>
              <tr><td style="padding:8px 12px; border:1px solid #e2e8f0; font-weight:600;">${totals.tcv > 0 ? "TCV" : "Scheduled"}</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${formatCurrency(totals.tcv > 0 ? totals.tcv : totals.scheduled, currency)}</td></tr>
            </tbody>
          </table>
          ${
            totals.warnings && totals.warnings.length
              ? `<div style="margin-top:16px; padding:12px; border:1px solid #fbbf24; background:#fffbeb; border-radius:6px;">
                  <div style="font-weight:600; color:#92400e; margin-bottom:6px;">Review recommended</div>
                  <ul style="margin:0; padding-left:20px; color:#78350f;">
                    ${totals.warnings.map((w) => `<li>${w.replace(/</g, "&lt;")}</li>`).join("")}
                  </ul>
                </div>`
              : ""
          }
          <p style="color:#64748b; font-size:12px; margin-top:24px;">
            The full ${format.toUpperCase()} report is attached.
          </p>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: list,
          from: "Recouply <notifications@send.inbound.services.recouply.ai>",
          subject: subject || `Financial Summary — ${contractName}`,
          html,
          attachments: [attachment],
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sent to ${list.length} recipient${list.length === 1 ? "" : "s"}`);
      setEmailOpen(false);
      setRecipients("");
      setNote("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={downloadPdf}>
            <FileText className="h-3.5 w-3.5 mr-2" /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadCsv}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEmail("pdf")}>
            <Mail className="h-3.5 w-3.5 mr-2" /> Email PDF to team
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEmail("csv")}>
            <Mail className="h-3.5 w-3.5 mr-2" /> Email CSV to team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email financial summary ({format.toUpperCase()})</DialogTitle>
            <DialogDescription>
              Send the financial summary for <strong>{contractName}</strong> to one or more team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recipients">Recipients</Label>
              <Input
                id="recipients"
                placeholder="alice@company.com, bob@company.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Separate multiple emails with commas.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                rows={3}
                placeholder="Add a short message…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendEmail} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
