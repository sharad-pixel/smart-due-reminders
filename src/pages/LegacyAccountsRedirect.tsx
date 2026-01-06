import { Navigate, useParams } from "react-router-dom";

export default function LegacyAccountsRedirect() {
  const { id } = useParams<{ id?: string }>();
  return <Navigate to={id ? `/debtors/${id}` : "/debtors"} replace />;
}
