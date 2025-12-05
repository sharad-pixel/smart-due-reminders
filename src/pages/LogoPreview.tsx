import newLogo from "@/assets/recouply-logo-new.png";
import newLogoV2 from "@/assets/recouply-logo-v2.png";
import currentLogo from "@/assets/recouply-logo.png";

const LogoPreview = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Logo Preview</h1>
      
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {/* New Logo V2 - Styled like original */}
        <div className="bg-card rounded-xl p-6 border shadow-lg ring-2 ring-primary">
          <h2 className="text-xl font-semibold mb-4 text-center">New V2 (Recommended)</h2>
          <div className="bg-white rounded-lg p-6 flex items-center justify-center">
            <img src={newLogoV2} alt="New Recouply Logo V2" className="w-40 h-40 object-contain" />
          </div>
          <p className="text-muted-foreground text-center mt-4 text-sm">
            Same style + AI/CashOps theme
          </p>
        </div>

        {/* New Logo V1 */}
        <div className="bg-card rounded-xl p-6 border shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">New V1</h2>
          <div className="bg-slate-900 rounded-lg p-6 flex items-center justify-center">
            <img src={newLogo} alt="New Recouply Logo" className="w-40 h-40 object-contain" />
          </div>
          <p className="text-muted-foreground text-center mt-4 text-sm">
            Stylized "R" with gradient
          </p>
        </div>

        {/* Current Logo */}
        <div className="bg-card rounded-xl p-6 border shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">Current Logo</h2>
          <div className="bg-slate-100 rounded-lg p-6 flex items-center justify-center">
            <img src={currentLogo} alt="Current Recouply Logo" className="w-40 h-40 object-contain" />
          </div>
          <p className="text-muted-foreground text-center mt-4 text-sm">
            Existing logo
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-muted-foreground">
          Let me know if you want to use the new logo or generate a different one!
        </p>
      </div>
    </div>
  );
};

export default LogoPreview;
