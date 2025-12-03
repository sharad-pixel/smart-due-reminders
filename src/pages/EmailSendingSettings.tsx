import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Redirect to the main email accounts page.
 * This page previously handled custom domain setup (BYOD) 
 * which is now deprecated in favor of platform email.
 */
const EmailSendingSettings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/settings/email-accounts", { replace: true });
  }, [navigate]);

  return null;
};

export default EmailSendingSettings;
