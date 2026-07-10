import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";
import {
  ChevronDown,
  Menu,
  X,
  FileSignature,
  Brain,
  LineChart,
  Bot,
  Zap,
  Rocket,
  Users,
  Building2,
  User,
  Quote,
  BarChart3,
  Newspaper,
  Info,
  ShieldCheck,
  Calculator,
  CreditCard,
  BookOpen,
  Briefcase,
} from "lucide-react";
import { useState } from "react";

type MenuItem = {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const productGroups: MenuGroup[] = [
  {
    label: "Platform",
    items: [
      { icon: FileSignature, title: "Contract Intelligence", description: "Extract terms, revenue, and renewal risk from every agreement.", path: "/contract-intelligence" },
      { icon: Brain, title: "Collection Intelligence", description: "Prioritized outreach with unified customer intelligence.", path: "/collection-intelligence" },
      { icon: LineChart, title: "Executive Insights", description: "Real-time cash forecasting and revenue exposure.", path: "/revenue-intelligence" },
    ],
  },
  {
    label: "Capabilities",
    items: [
      { icon: Bot, title: "AI Agents", description: "Autonomous collection personas with human approval.", path: "/personas" },
      { icon: Zap, title: "Automation", description: "Workflow orchestration across contract-to-cash.", path: "/automation" },
      { icon: BarChart3, title: "Analytics", description: "Aging, DSO, cohort, and cash trajectory.", path: "/analytics" },
    ],
  },
];

const solutionsGroups: MenuGroup[] = [
  {
    label: "By company size",
    items: [
      { icon: User, title: "Launch", description: "Full platform for independent operators.", path: "/solutions/solo-pro" },
      { icon: Rocket, title: "Startups", description: "Scale collections from day one.", path: "/startups" },
      { icon: Users, title: "SMB", description: "Right-sized for growing finance teams.", path: "/smb" },
      { icon: Building2, title: "Enterprise", description: "Multi-entity, SSO, custom roles.", path: "/enterprise" },
    ],
  },
  {
    label: "By workflow",
    items: [
      { icon: FileSignature, title: "Professional Services", description: "Milestone billing and PS revenue capture.", path: "/solutions/professional-services" },
      { icon: Brain, title: "SaaS Revenue", description: "MRR, ARR, renewals, and churn signal.", path: "/solutions/saas" },
      { icon: Building2, title: "Small Business", description: "Simple collections without the overhead.", path: "/solutions/small-businesses" },
    ],
  },
];

const customersItems: MenuItem[] = [
  { icon: Quote, title: "Resources", description: "Revenue Intelligence Hub — articles, guides, playbooks.", path: "/resources" },
  { icon: BarChart3, title: "Collections ROI Calculator", description: "Estimate cost of delay and write-off risk.", path: "/roi-calculator" },
  { icon: Calculator, title: "Contract Intelligence ROI", description: "Quantify revenue leakage in signed agreements.", path: "/contract-roi-calculator" },
  { icon: CreditCard, title: "Payment Portal", description: "Where your customers pay, upload W-9s, and self-serve.", path: "/debtor-portal" },
];

const companyItems: MenuItem[] = [
  { icon: Info, title: "About", description: "Our mission for finance teams.", path: "/about" },
  { icon: Newspaper, title: "Resources", description: "Revenue Intelligence Hub.", path: "/resources" },
  { icon: Briefcase, title: "Careers", description: "Build the future of enterprise finance.", path: "/careers" },
  { icon: ShieldCheck, title: "Trust Center", description: "Security, privacy, and compliance.", path: "/trust" },
  { icon: BookOpen, title: "Knowledge Base", description: "Docs, guides, and best practices.", path: "/knowledge-base" },
];

const MegaMenu = ({
  label,
  groups,
  navigate,
}: {
  label: string;
  groups: MenuGroup[];
  navigate: (path: string) => void;
}) => (
  <div className="relative group">
    <button className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1 py-2">
      {label}
      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
    </button>
    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
      <div
        className="bg-card border border-border/70 rounded-xl shadow-2xl overflow-hidden"
        style={{ width: `${Math.min(720, 360 * groups.length)}px` }}
      >
        <div className={`grid gap-0 ${groups.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {groups.map((group, gi) => (
            <div
              key={group.label}
              className={`p-5 ${gi > 0 ? "border-l border-border/60" : ""}`}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-3 px-2">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full text-left px-2 py-2.5 hover:bg-muted/70 rounded-lg transition-colors flex items-start gap-3 group/item"
                  >
                    <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground leading-snug">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SimpleMenu = ({
  label,
  items,
  navigate,
}: {
  label: string;
  items: MenuItem[];
  navigate: (path: string) => void;
}) => (
  <div className="relative group">
    <button className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1 py-2">
      {label}
      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
    </button>
    <div className="absolute top-full right-0 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
      <div className="w-80 bg-card border border-border/70 rounded-xl shadow-2xl p-2">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full text-left px-2 py-2.5 hover:bg-muted/70 rounded-lg transition-colors flex items-start gap-3 group/item"
          >
            <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm text-foreground">{item.title}</div>
              <div className="text-xs text-muted-foreground leading-snug">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const EnterpriseNav = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const goto = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center shrink-0" aria-label="Recouply home">
          <RecouplyLogo size="md" />
        </Link>

        {/* Desktop */}
        <nav className="hidden lg:flex items-center gap-7">
          <MegaMenu label="Product" groups={productGroups} navigate={navigate} />
          <MegaMenu label="Solutions" groups={solutionsGroups} navigate={navigate} />
          <SimpleMenu label="Customers" items={customersItems} navigate={navigate} />
          <button
            onClick={() => navigate("/pricing")}
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors py-2"
          >
            Pricing
          </button>
          <SimpleMenu label="Company" items={companyItems} navigate={navigate} />
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Button onClick={() => navigate("/login")} variant="ghost" size="sm" className="text-sm font-medium">
            Sign In
          </Button>
          <Button
            onClick={() => navigate("/contact?intent=demo")}
            size="sm"
            variant="outline"
            className="text-sm font-medium border-border/70"
          >
            Book a Demo
          </Button>
          <Button
            onClick={() => navigate("/signup")}
            size="sm"
            className="text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
          >
            Get Started
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="lg:hidden flex items-center gap-2">
          <Button onClick={() => navigate("/login")} variant="ghost" size="sm">
            Sign In
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border/60 bg-background">
          <div className="container mx-auto px-4 py-4 space-y-5 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {[
              { title: "Product", groups: productGroups },
              { title: "Solutions", groups: solutionsGroups },
            ].map((section) => (
              <div key={section.title}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                  {section.title}
                </div>
                {section.groups.flatMap((g) => g.items).map((item) => (
                  <button
                    key={item.path}
                    onClick={() => goto(item.path)}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-3"
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{item.title}</span>
                  </button>
                ))}
              </div>
            ))}

            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                Customers
              </div>
              {customersItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => goto(item.path)}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-3"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{item.title}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                Company
              </div>
              {companyItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => goto(item.path)}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-3"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{item.title}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
              <button
                onClick={() => goto("/pricing")}
                className="text-left py-2 text-sm font-medium"
              >
                Pricing
              </button>
              <Button
                onClick={() => goto("/contact?intent=demo")}
                variant="outline"
                className="w-full"
              >
                Book a Demo
              </Button>
              <Button
                onClick={() => goto("/signup")}
                className="w-full bg-foreground text-background hover:bg-foreground/90"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default EnterpriseNav;
