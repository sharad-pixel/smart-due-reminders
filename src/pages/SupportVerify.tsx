import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SupportVerify = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/support/login", { replace: true });
  }, [navigate]);
  return null;
};

export default SupportVerify;
