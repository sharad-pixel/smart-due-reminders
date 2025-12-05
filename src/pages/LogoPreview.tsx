import newLogo from "@/assets/recouply-logo-new.png";
import currentLogo from "@/assets/recouply-logo.png";

const LogoPreview = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Logo Preview</h1>
      
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
        {/* New Logo */}
        <div className="bg-card rounded-xl p-8 border shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">New AI CashOps Logo</h2>
          <div className="bg-slate-900 rounded-lg p-8 flex items-center justify-center">
            <img src={newLogo} alt="New Recouply Logo" className="w-48 h-48 object-contain" />
          </div>
          <p className="text-muted-foreground text-center mt-4 text-sm">
            Stylized "R" with teal/emerald gradient
          </p>
        </div>

        {/* Current Logo */}
        <div className="bg-card rounded-xl p-8 border shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">Current Logo</h2>
          <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center">
            <img src={currentLogo} alt="Current Recouply Logo" className="w-48 h-48 object-contain" />
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
