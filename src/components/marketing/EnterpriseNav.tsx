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
  Plug,
  Workflow,
  Boxes,
  ClipboardCheck,
  Layers,
  Store,
  Library,
  Mail,
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
    label: "Revenue Intelligence",
    items: [
      { icon: Brain, title: "Collection Intelligence", description: "Risk-prioritized outreach with unified customer context.", path: "/collection-intelligence" },
      { icon: FileSignature, title: "Contract Intelligence", description: "Extract terms, revenue, and renewal risk from agreements.", path: "/contract-intelligence" },
      { icon: LineChart, title: "Executive Insights", description: "Cash forecasting and revenue exposure in real time.", path: "/revenue-intelligence" },
    ],
  },
  {
    label: "Capabilities",
    items: [
      { icon: Bot, title: "AI Agents", description: "Collection personas with human approval.", path: "/personas" },
      { icon: Zap, title: "Automation", description: "Workflow orchestration across order to cash.", path: "/automation" },
      { icon: BarChart3, title: "Analytics", description: "Aging, DSO, cohorts, and cash trajectory.", path: "/analytics" },
      { icon: CreditCard, title: "Payment Portal", description: "Where your customers pay and self-serve.", path: "/debtor-portal" },
      { icon: Plug, title: "Integrations", description: "Stripe, QuickBooks, NetSuite, Salesforce and more.", path: "/integrations" },
    ],
  },
];

const servicesGroups: MenuGroup[] = [
  {
    label: "Enterprise Services",
    items: [
      { icon: Workflow, title: "O2C Transformation", description: "Discover, design, build, govern, and optimize order to cash.", path: "/o2c-transformation" },
      { icon: Boxes, title: "Custom Business Applications", description: "Purpose-built apps around your workflows, data, and controls.", path: "/o2c-transformation#custom-applications" },
      { icon: ClipboardCheck, title: "Request an Assessment", description: "Talk to us about your O2C challenges.", path: "/o2c-transformation#assessment" },
    ],
  },
];

const solutionsGroups: MenuGroup[] = [
  {
    label: "By company size",
    items: [
      { icon: User, title: "Launch", description: "Full platform for independent operators.", path: "/solutions/solo-pro" },
      { icon: Rocket, title: "Startups", description: "Build revenue discipline from day one.", path: "/startups" },
      { icon: Users, title: "SMB", description: "Right-sized for growing finance teams.", path: "/smb" },
      { icon: Building2, title: "Enterprise", description: "Multi-entity, SSO, custom roles.", path: "/enterprise" },
    ],
  },
  {
    label: "By business model",
    items: [
      { icon: Layers, title: "SaaS", description: "Subscriptions, renewals, and usage billing.", path: "/solutions/saas" },
      { icon: Briefcase, title: "Professional Services", description: "Milestone billing and PS revenue capture.", path: "/solutions/professional-services" },
      { icon: Store, title: "Small Businesses", description: "Get paid faster without extra headcount.", path: "/solutions/small-businesses" },
    ],
  },
];

const resourcesGroups: MenuGroup[] = [
  {
    label: "Learn",
    items: [
      { icon: Newspaper, title: "Revenue Intelligence Hub", description: "Articles, guides, and playbooks.", path: "/resources" },
      { icon: BookOpen, title: "Blog", description: "Finance and O2C transformation insights.", path: "/blog" },
      { icon: Library, title: "Knowledge Base", description: "Docs and best practices.", path: "/knowledge-base" },
    ],
  },
  {
    label: "Tools",
    items: [
      { icon: Calculator, title: "Collections ROI Calculator", description: "Estimate cost of delay and write-off risk.", path: "/roi-calculator" },
      { icon: Quote, title: "Contract Intelligence ROI", description: "Quantify leakage in signed agreements.", path: "/contract-roi-calculator" },
    ],
  },
];

const companyItems: MenuItem[] = [
  { icon: Info, title: "About", description: "Our mission for finance teams.", path: "/about" },
  { icon: Briefcase, title: "Careers", description: "Build the future of enterprise finance.", path: "/careers" },
  { icon: ShieldCheck, title: "Trust Center", description: "Security, privacy, and compliance.", path: "/trust" },
  { icon: Mail, title: "Contact", description: "Talk to the Recouply.ai team.", path: "/contact" },
];

const companyGroups: MenuGroup[] = [{ label: "Company", items: companyItems }];

const MENUS: { label: string; groups: MenuGroup[] }[] = [
  { label: "Platform", groups: productGroups },
  { label: "Services", groups: servicesGroups },
  { label: "Solutions", groups: solutionsGroups },
  { label: "Resources", groups: resourcesGroups },
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
    <div className={`absolute top-full pt-3 ${label === "Platform" ? "left-0" : "left-1/2 -translate-x-1/2"} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
      <div
        className="bg-card border border-border/70 rounded-xl shadow-2xl overflow-hidden"
        style={{ width: `${groups.length > 1 ? 680 : 380}px` }}
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
        <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
          {MENUS.map((m) => (
            <MegaMenu key={m.label} label={m.label} groups={m.groups} navigate={navigate} />
          ))}
          <button
            onClick={() => navigate("/pricing")}
            className="whitespace-nowrap text-sm font-medium text-foreground/80 hover:text-foreground transition-colors py-2"
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
            Start Free
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
            {[...MENUS, { label: "Company", groups: companyGroups }].map((section) => (
              <div key={section.label}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                  {section.label}
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
                Start Free
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default EnterpriseNav;
