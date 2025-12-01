import { DocumentApproval } from "@prisma/client";
import { AlertTriangle, Clock, FileCheck } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface DocumentStatusProps {
  readonly label: string;
  readonly document?: DocumentApproval;
}

function LabelAndBadge({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function DocumentStatus({ label, document }: DocumentStatusProps) {
  if (!document) {
    return (
      <LabelAndBadge label={label}>
        <Badge variant="outline" className="bg-muted">
          Not Uploaded
        </Badge>
      </LabelAndBadge>
    );
  }

  const statusConfig = {
    PENDING: {
      variant: "outline" as const,
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Pending Review",
    },
    APPROVED: {
      variant: "secondary" as const,
      className:
        "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
      icon: <FileCheck className="h-3.5 w-3.5" />,
      label: "Approved",
    },
    REJECTED: {
      variant: "destructive" as const,
      className: "",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "Rejected",
    },
  };

  const config = statusConfig[document.status] || statusConfig.PENDING;

  return (
    <LabelAndBadge label={label}>
      <Badge variant={config.variant} className={cn("gap-1", config.className)}>
        {config.icon}
        {config.label}
      </Badge>
    </LabelAndBadge>
  );
}
