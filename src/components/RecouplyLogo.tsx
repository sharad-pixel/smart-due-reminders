import { Link } from "react-router-dom";
import recouplyLogo from "@/assets/recouply-logo.png";

interface RecouplyLogoProps {
  variant?: "header" | "footer";
  className?: string;
}

const RecouplyLogo = ({ variant = "header", className = "" }: RecouplyLogoProps) => {
  const isHeader = variant === "header";
  
  return (
    <Link 
      to="/" 
      className={`flex items-center gap-3 ${className}`}
      aria-label="Recouply.ai – AI-powered Cash Operations"
    >
      <img 
        src={recouplyLogo} 
        alt="Recouply.ai – AI-powered Cash Operations"
        className={`w-auto ${isHeader ? "h-7 md:h-9" : "h-6 opacity-90"}`}
      />
    </Link>
  );
};

export default RecouplyLogo;
