import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import {
  generateDemoCustomers,
  generateDemoInvoices,
  generateDemoDrafts,
  getDemoStats,
  getDemoAgingBuckets,
  DemoCustomer,
  DemoInvoice,
  DemoDraft,
} from "@/lib/demoData";

export type DemoStep = "overview" | "activate" | "drafts" | "sending" | "payments" | "results";

interface DemoState {
  isDemoMode: boolean;
  step: DemoStep;
  customers: DemoCustomer[];
  invoices: DemoInvoice[];
  drafts: DemoDraft[];
  stats: ReturnType<typeof getDemoStats>;
  agingBuckets: ReturnType<typeof getDemoAgingBuckets>;
  sentCount: number;
  paidInvoiceIds: string[];
  recoveredAmount: number;
  isAnimating: boolean;
}

interface DemoContextValue extends DemoState {
  startDemo: () => void;
  exitDemo: () => void;
  goToStep: (step: DemoStep) => void;
  activateCollections: () => void;
  startSending: () => void;
  simulatePayments: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const useDemoContext = () => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoContext must be used within DemoProvider");
  return ctx;
};

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const customers = useMemo(() => generateDemoCustomers(), []);
  const invoicesRef = useRef(generateDemoInvoices(customers));
  
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [step, setStep] = useState<DemoStep>("overview");
  const [invoices, setInvoices] = useState<DemoInvoice[]>(invoicesRef.current);
  const [drafts, setDrafts] = useState<DemoDraft[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [paidInvoiceIds, setPaidInvoiceIds] = useState<string[]>([]);
  const [recoveredAmount, setRecoveredAmount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const stats = useMemo(() => getDemoStats(invoices), [invoices]);
  const agingBuckets = useMemo(() => getDemoAgingBuckets(invoices), [invoices]);

  const startDemo = useCallback(() => {
    const freshInvoices = generateDemoInvoices(customers);
    invoicesRef.current = freshInvoices;
    setInvoices(freshInvoices);
    setDrafts([]);
    setSentCount(0);
    setPaidInvoiceIds([]);
    setRecoveredAmount(0);
    setStep("overview");
    setIsDemoMode(true);
  }, [customers]);

  const exitDemo = useCallback(() => {
    setIsDemoMode(false);
    setStep("overview");
  }, []);

  const goToStep = useCallback((s: DemoStep) => setStep(s), []);

  const activateCollections = useCallback(() => {
    setIsAnimating(true);
    const newDrafts = generateDemoDrafts(invoicesRef.current);
    // Stagger draft appearance
    const batchSize = 8;
    let added = 0;
    const interval = setInterval(() => {
      added += batchSize;
      setDrafts(newDrafts.slice(0, Math.min(added, newDrafts.length)));
      if (added >= newDrafts.length) {
        clearInterval(interval);
        setIsAnimating(false);
        setStep("drafts");
      }
    }, 200);
    setStep("activate");
  }, []);

  const startSending = useCallback(() => {
    setIsAnimating(true);
    setStep("sending");
    // Approve all, then send progressively
    setDrafts(prev => prev.map(d => ({ ...d, status: "approved" as const })));
    let sent = 0;
    const total = drafts.length || 45; // fallback
    const interval = setInterval(() => {
      sent += Math.floor(Math.random() * 4) + 2;
      if (sent >= total) sent = total;
      setSentCount(sent);
      setDrafts(prev =>
        prev.map((d, i) => i < sent ? { ...d, status: "sent" as const } : d)
      );
      if (sent >= total) {
        clearInterval(interval);
        setIsAnimating(false);
        setTimeout(() => setStep("payments"), 800);
      }
    }, 400);
  }, [drafts.length]);

  const simulatePayments = useCallback(() => {
    setIsAnimating(true);
    // Pick 3 high-value overdue invoices to mark paid
    const overdue = invoicesRef.current
      .filter(i => i.status === "overdue")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    let paidIdx = 0;
    const interval = setInterval(() => {
      if (paidIdx >= overdue.length) {
        clearInterval(interval);
        setIsAnimating(false);
        setTimeout(() => setStep("results"), 1200);
        return;
      }
      const inv = overdue[paidIdx];
      setPaidInvoiceIds(prev => [...prev, inv.id]);
      setRecoveredAmount(prev => prev + inv.amount);
      setInvoices(prev =>
        prev.map(i => i.id === inv.id ? { ...i, status: "paid" as const } : i)
      );
      paidIdx++;
    }, 1500);
  }, []);

  const value: DemoContextValue = {
    isDemoMode, step, customers, invoices, drafts, stats, agingBuckets,
    sentCount, paidInvoiceIds, recoveredAmount, isAnimating,
    startDemo, exitDemo, goToStep, activateCollections, startSending, simulatePayments,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};
