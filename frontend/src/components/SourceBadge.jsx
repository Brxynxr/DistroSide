import { AlertTriangle, CheckCircle2, Database, Sparkles } from "lucide-react";
import Badge from "./ui/Badge.jsx";

const VARIANT_MAP = {
  sql: "primary",
  alert: "warning",
  danger: "negative",
  positive: "positive",
  ai: "ai",
};

const ICON_MAP = {
  sql: Database,
  alert: AlertTriangle,
  danger: AlertTriangle,
  positive: CheckCircle2,
  ai: Sparkles,
};

/**
 * Wrapper semántico sobre Badge para distinguir datos SQL, Alertas e IA.
 */
export default function SourceBadge({ variant = "sql", showIcon = false, children, className = "" }) {
  return (
    <Badge
      variant={VARIANT_MAP[variant] || "neutral"}
      icon={showIcon ? ICON_MAP[variant] : undefined}
      className={className}
    >
      {children}
    </Badge>
  );
}
