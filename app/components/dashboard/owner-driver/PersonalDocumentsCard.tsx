import { Link } from "@remix-run/react";
import { ExternalLink, User } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DocumentStatus } from "./DocumentStatus";
import type { PersonalDocuments } from "./types";

interface PersonalDocumentsCardProps {
  readonly documents?: PersonalDocuments;
}

export function PersonalDocumentsCard({ documents }: PersonalDocumentsCardProps) {
  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Documents
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/fleet-owner/onboarding" aria-label="Manage documents">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <DocumentStatus label="NIN (National ID)" document={documents?.nin} />
          <DocumentStatus label="Driver's License" document={documents?.driversLicense} />
          <DocumentStatus label="LASDRI Certificate" document={documents?.lasdri} />
        </div>
      </CardContent>
    </Card>
  );
}
