import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentsList from "@/components/DocumentsList";
import { FileText, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

export default function Documents() {
  const [activeTab, setActiveTab] = useState("all");
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { isTeamMember } = useEffectiveAccount();

  // Get document statistics
  const { data: stats } = useQuery({
    queryKey: ["document-stats", organization?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("documents")
        .select("status, category");

      if (organization?.id) {
        query = query.eq("organization_id", organization.id);
      } else {
        query = query.eq("uploaded_by_user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data.length;
      const pendingReview = data.filter(d => d.status === "pending_review").length;
      const verified = data.filter(d => d.status === "verified").length;
      const expired = data.filter(d => d.status === "expired").length;

      return { total, pendingReview, verified, expired };
    },
    enabled: !orgLoading,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Documents & Compliance</h1>
          <p className="text-muted-foreground">
            Manage business documents, compliance forms, and supporting files with AI-powered validation
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{stats?.total || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                <span className="text-2xl font-bold">{stats?.pendingReview || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Verified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold">{stats?.verified || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expired
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="text-2xl font-bold">{stats?.expired || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className={`grid ${!isTeamMember ? 'md:grid-cols-3' : ''} gap-6`}>
          {/* Upload Section - Only for Parent Accounts */}
          {!isTeamMember && (
            <div>
              <DocumentUpload organizationId={organization?.id} />
            </div>
          )}

          {/* Documents List */}
          <div className={!isTeamMember ? "md:col-span-2" : ""}>
            <Card>
              <CardHeader>
                <CardTitle>Your Documents</CardTitle>
                <CardDescription>
                  View, manage, and verify uploaded documents. AI automatically analyzes each document and creates tasks for any issues found.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="verified">Verified</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="mt-6">
                    <DocumentsList organizationId={organization?.id} isParentAccount={!isTeamMember} />
                  </TabsContent>
                  <TabsContent value="pending" className="mt-6">
                    <DocumentsList organizationId={organization?.id} isParentAccount={!isTeamMember} />
                  </TabsContent>
                  <TabsContent value="verified" className="mt-6">
                    <DocumentsList organizationId={organization?.id} isParentAccount={!isTeamMember} />
                  </TabsContent>
                  <TabsContent value="expired" className="mt-6">
                    <DocumentsList organizationId={organization?.id} isParentAccount={!isTeamMember} />
                  </TabsContent>
                  <TabsContent value="rejected" className="mt-6">
                    <DocumentsList organizationId={organization?.id} isParentAccount={!isTeamMember} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Information Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Supported Document Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    <strong>ACH Forms:</strong> Bank authorization for ACH transfers
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    <strong>Wire Instructions:</strong> International wire transfer details
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    <strong>W-9 Forms:</strong> Tax documentation for IRS reporting
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    <strong>Contracts:</strong> Service agreements and terms
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    <strong>Compliance Docs:</strong> Business licenses, proof of business, EIN letters
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                AI-Powered Validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    Automatic detection of missing signatures and dates
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    Validation of account numbers, routing numbers, and tax IDs
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    Detection of outdated or expired documents
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    Automatic task creation for document issues
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <div>
                    Full audit trail of all document access and changes
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
