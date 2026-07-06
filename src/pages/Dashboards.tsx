import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutDashboard,
  Sparkles,
  DollarSign,
  FileText,
  ShieldAlert,
  Mail,
  FileSignature,
  ArrowUpRight,
} from "lucide-react";

interface DashboardTile {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const dashboards: DashboardTile[] = [
  {
    title: "Revenue Hub",
    description: "Executive view of ARR, collections velocity, and pipeline health.",
    path: "/hub",
    icon: Sparkles,
    tag: "Executive",
  },
  {
    title: "Collections Overview",
    description: "Aging buckets, outreach engagement and daily collection performance.",
    path: "/dashboard",
    icon: LayoutDashboard,
    tag: "Operational",
  },
  {
    title: "Payments Activity",
    description: "Applied payments, reconciliations, and open balances by account.",
    path: "/payments",
    icon: DollarSign,
    tag: "Finance",
  },
  {
    title: "Invoices",
    description: "Open, disputed, and voided invoices across integrations.",
    path: "/invoices",
    icon: FileText,
    tag: "AR",
  },
  {
    title: "Revenue Risk",
    description: "ECL, collectability scoring, and expansion risk signals.",
    path: "/revenue-risk",
    icon: ShieldAlert,
    tag: "Risk",
  },
  {
    title: "Contracts",
    description: "Active contracts, billing schedules, and ASC 606 assessments.",
    path: "/contracts",
    icon: FileSignature,
    tag: "Contract",
  },
  {
    title: "Email Delivery",
    description: "Deliverability, bounces, and complaints for outbound email.",
    path: "/reports/email-delivery",
    icon: Mail,
    tag: "Deliverability",
  },
];

export default function Dashboards() {
  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground max-w-2xl">
            Every operating view of Recouply in one place. Choose a dashboard to drill into
            revenue, collections, risk, or deliverability.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => {
            const Icon = d.icon;
            return (
              <Link key={d.path} to={d.path} className="group">
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardTitle className="text-base mt-3">{d.title}</CardTitle>
                    {d.tag && (
                      <span className="inline-flex w-fit text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                        {d.tag}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed">
                      {d.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
