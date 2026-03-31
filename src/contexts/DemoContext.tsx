import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import {
  generateDemoCustomers,
  generateDemoInvoices,
  generateDemoDrafts,
  generateDemoPaymentHistory,
  getDemoStats,
  getDemoAgingBuckets,
  DemoCustomer,
  DemoInvoice,
  DemoDraft,
  DemoPaymentHistory,
} from "@/lib/demoData";

export type DemoStep =
  | "email_gate"
  | "welcome"
  | "setup_accounts"
  | "setup_invoices"
  | "integrations"
  | "data_import"
  | "revenue_risk"
  | "collection_intelligence"
  | "inbound_ai"
  | "activate"
  | "drafts"
  | "outreach_forecast"
  | "sending"
  | "outreach_history"
  | "payments"
  | "data_export"
  | "results";

export const DEMO_STEPS: { key: DemoStep; label: string; group: string }[] = [
  { key: "email_gate", label: "Get Started", group: "Start" },
  { key: "welcome", label: "Welcome", group: "Start" },
  { key: "setup_accounts", label: "Accounts", group: "Setup" },
  { key: "setup_invoices", label: "Invoices", group: "Setup" },
  { key: "integrations", label: "Integrations", group: "Setup" },
  { key: "data_import", label: "Data Import", group: "Data" },
  { key: "revenue_risk", label: "Revenue Risk", group: "Intelligence" },
  { key: "collection_intelligence", label: "Collection Intel", group: "Intelligence" },
  { key: "inbound_ai", label: "Inbound AI", group: "Intelligence" },
  { key: "activate", label: "AI Activation", group: "Outreach" },
  { key: "drafts", label: "Draft Review", group: "Outreach" },
  { key: "outreach_forecast", label: "Forecast", group: "Outreach" },
  { key: "sending", label: "Sending", group: "Outreach" },
  { key: "outreach_history", label: "History", group: "Outreach" },
  { key: "payments", label: "Payments", group: "Recovery" },
  { key: "data_export", label: "Data Export", group: "Data" },
  { key: "results", label: "ROI Results", group: "Recovery" },
];

interface DemoState {
  isDemoMode: boolean;
  step: DemoStep;
  demoEmail: string;
  customers: DemoCustomer[];
  invoices: DemoInvoice[];
  drafts: DemoDraft[];
  stats: ReturnType<typeof getDemoStats>;
  agingBuckets: ReturnType<typeof getDemoAgingBuckets>;
  paymentHistory: DemoPaymentHistory[];
  sentCount: number;
  paidInvoiceIds: string[];
  recoveredAmount: number;
  isAnimating: boolean;
  completedSteps: DemoStep[];
}

interface DemoContextValue extends DemoState {
  startDemo: () => void;
  exitDemo: () => void;
  goToStep: (step: DemoStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setDemoEmail: (email: string) => void;
  activateCollections: () => void;
  startSending: () => void;
  simulatePayments: () => void;
  markStepComplete: (step: DemoStep) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const useDemoContext = () => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoContext must be used within DemoProvider");
  return ctx;
};

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const customers = useMemo(() => generateDemoCustomers(), []);
  const paymentHistory = useMemo(() => generateDemoPaymentHistory(customers), [customers]);
  const invoicesRef = useRef(generateDemoInvoices(customers));

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [step, setStep] = useState<DemoStep>("email_gate");
  const [demoEmail, setDemoEmail] = useState("");
  const [invoices, setInvoices] = useState<DemoInvoice[]>(invoicesRef.current);
  const [drafts, setDrafts] = useState<DemoDraft[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [paidInvoiceIds, setPaidInvoiceIds] = useState<string[]>([]);
  const [recoveredAmount, setRecoveredAmount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<DemoStep[]>([]);

  const stats = useMemo(() => getDemoStats(invoices), [invoices]);
  const agingBuckets = useMemo(() => getDemoAgingBuckets(invoices), [invoices]);

  const markStepComplete = useCallback((s: DemoStep) => {
    setCompletedSteps(prev => prev.includes(s) ? prev : [...prev, s]);
  }, []);

  const startDemo = useCallback(() => {
    const freshInvoices = generateDemoInvoices(customers);
    invoicesRef.current = freshInvoices;
    setInvoices(freshInvoices);
    setDrafts([]);
    setSentCount(0);
    setPaidInvoiceIds([]);
    setRecoveredAmount(0);
    setStep("email_gate");
    setIsDemoMode(true);
    setCompletedSteps([]);
  }, [customers]);

  const exitDemo = useCallback(() => {
    setIsDemoMode(false);
    setStep("email_gate");
  }, []);

  const goToStep = useCallback((s: DemoStep) => setStep(s), []);

  const nextStep = useCallback(() => {
    const idx = DEMO_STEPS.findIndex(s => s.key === step);
    if (idx < DEMO_STEPS.length - 1) {
      markStepComplete(step);
      setStep(DEMO_STEPS[idx + 1].key);
    }
  }, [step, markStepComplete]);

  const prevStep = useCallback(() => {
    const idx = DEMO_STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(DEMO_STEPS[idx - 1].key);
  }, [step]);

  const activateCollections = useCallback(() => {
    setIsAnimating(true);
    const newDrafts = generateDemoDrafts(invoicesRef.current);
    const batchSize = 8;
    let added = 0;
    const interval = setInterval(() => {
      added += batchSize;
      setDrafts(newDrafts.slice(0, Math.min(added, newDrafts.length)));
      if (added >= newDrafts.length) {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 200);
  }, []);

  const startSending = useCallback(() => {
    setIsAnimating(true);
    setDrafts(prev => prev.map(d => ({ ...d, status: "approved" as const })));
    let sent = 0;
    const total = drafts.length || 45;
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
      }
    }, 400);
  }, [drafts.length]);

  const simulatePayments = useCallback(() => {
    setIsAnimating(true);
    const overdue = invoicesRef.current
      .filter(i => i.status === "overdue")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    let paidIdx = 0;
    const interval = setInterval(() => {
      if (paidIdx >= overdue.length) {
        clearInterval(interval);
        setIsAnimating(false);
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
    isDemoMode, step, demoEmail, customers, invoices, drafts, stats, agingBuckets,
    paymentHistory, sentCount, paidInvoiceIds, recoveredAmount, isAnimating, completedSteps,
    startDemo, exitDemo, goToStep, nextStep, prevStep, setDemoEmail,
    activateCollections, startSending, simulatePayments, markStepComplete,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};
