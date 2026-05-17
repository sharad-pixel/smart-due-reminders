import { Navigate, useSearchParams } from "react-router-dom";

// Redirects legacy /billing/asc606-credits → unified /billing?tab=credits, preserving query params.
export default function Asc606Credits() {
  const [params] = useSearchParams();
  const merged = new URLSearchParams(params);
  if (!merged.get("tab")) merged.set("tab", "credits");
  return <Navigate to={`/billing?${merged.toString()}`} replace />;
}
