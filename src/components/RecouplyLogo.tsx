import { Link } from "react-router-dom";
import recouplyLogo from "@/assets/recouply-logo.png";

interface RecouplyLogoProps {
  variant?: "header" | "footer";
  className?: string;
}

const RecouplyLogo = ({ variant = "header", className = "" }: RecouplyLogoProps) => {
  const sizes = {
    header: "h-8 md:h-9", // 32-36px
    footer: "h-6 md:h-7 opacity-90", // 24-28px with reduced opacity
  };

  return (
    <Link 
      to="/" 
      className={`flex items-center gap-2 ${className}`}
      aria-label="Recouply.ai – AI-powered Cash Operations"
    >
      <img 
        src={recouplyLogo} 
        alt="Recouply.ai – AI-powered Cash Operations"
        className={`w-auto ${sizes[variant]}`}
      />
    </Link>
  );
};

export default RecouplyLogo;
