import EnterpriseNav from "@/components/marketing/EnterpriseNav";
import NicolasChat from "@/components/nicolas/NicolasChat";
import MarketingFooter from "@/components/marketing/MarketingFooter";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EnterpriseNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <NicolasChat />
    </div>
  );
};

export default MarketingLayout;
