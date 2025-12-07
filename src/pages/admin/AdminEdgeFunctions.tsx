import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Play, CheckCircle, XCircle, Clock, AlertTriangle, Info, Mail, Shield, Bot, Database, Webhook } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FunctionConfig {
  name: string;
  category: "email" | "ai" | "admin" | "webhook" | "cron" | "utility";
  requiresAuth: boolean;
  requiresPayload: boolean;
  expectedBehavior: string;
  testPayload?: Record<string, unknown>;
}

interface FunctionTest extends FunctionConfig {
  status: "idle" | "running" | "success" | "error" | "expected_error";
  statusCode?: number;
  responseTime?: number;
  error?: string;
  response?: string;
}

const edgeFunctionConfigs: FunctionConfig[] = [
  // Email functions
  { name: "send-email", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth - requires auth header" },
  { name: "send-ai-draft", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth - requires draft_id" },
  { name: "send-collection-email", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "send-welcome-email", category: "email", requiresAuth: false, requiresPayload: true, expectedBehavior: "200 with valid payload", testPayload: { email: "test@example.com", companyName: "Test", userName: "Test", userId: "00000000-0000-0000-0000-000000000000" } },
  { name: "send-admin-alert", category: "email", requiresAuth: false, requiresPayload: true, expectedBehavior: "200 with valid payload", testPayload: { type: "waitlist", email: "test@example.com", name: "Test" } },
  { name: "send-task-assignment", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "send-account-summary", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "test-email", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "forward-inbound-email", category: "email", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  
  // Webhook functions (public endpoints)
  { name: "resend-inbound-tasks", category: "webhook", requiresAuth: false, requiresPayload: true, expectedBehavior: "400 without proper Resend payload" },
  { name: "stripe-webhook", category: "webhook", requiresAuth: false, requiresPayload: true, expectedBehavior: "400 without signature" },
  
  // AI functions
  { name: "process-inbound-ai", category: "ai", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - processes pending emails" },
  { name: "generate-bucket-drafts", category: "ai", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "generate-bulk-ai-drafts", category: "ai", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "process-persona-command", category: "ai", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "regenerate-draft", category: "ai", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "ai-match-payments", category: "ai", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  
  // Cron/scheduled functions
  { name: "daily-digest-runner", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - runs digest job", testPayload: {} },
  { name: "daily-cadence-scheduler", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - schedules cadence" },
  { name: "daily-workflow-reassignment", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - reassigns workflows" },
  { name: "auto-generate-collection-drafts", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - generates drafts" },
  { name: "auto-send-approved-drafts", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - sends approved drafts" },
  { name: "data-retention-cron", category: "cron", requiresAuth: false, requiresPayload: false, expectedBehavior: "200 - cleans old data" },
  
  // Admin functions
  { name: "admin-list-users", category: "admin", requiresAuth: true, requiresPayload: false, expectedBehavior: "401 without auth" },
  { name: "admin-update-user", category: "admin", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "admin-get-user-details", category: "admin", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "delete-user", category: "admin", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  
  // Utility functions
  { name: "calculate-payment-score", category: "utility", requiresAuth: false, requiresPayload: true, expectedBehavior: "400 without debtor_id" },
  { name: "risk-engine", category: "utility", requiresAuth: false, requiresPayload: true, expectedBehavior: "Calculates risk scores" },
  { name: "get-monthly-usage", category: "utility", requiresAuth: true, requiresPayload: false, expectedBehavior: "401 without auth" },
  { name: "get-effective-features", category: "utility", requiresAuth: true, requiresPayload: false, expectedBehavior: "401 without auth" },
  { name: "check-whitelist", category: "utility", requiresAuth: false, requiresPayload: true, expectedBehavior: "400 without email" },
  { name: "encrypt-field", category: "utility", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
  { name: "decrypt-field", category: "utility", requiresAuth: true, requiresPayload: true, expectedBehavior: "401 without auth" },
];

const categoryIcons: Record<FunctionConfig["category"], React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  ai: <Bot className="h-4 w-4" />,
  admin: <Shield className="h-4 w-4" />,
  webhook: <Webhook className="h-4 w-4" />,
  cron: <Clock className="h-4 w-4" />,
  utility: <Database className="h-4 w-4" />,
};

const categoryColors: Record<FunctionConfig["category"], string> = {
  email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ai: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  webhook: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  cron: "bg-green-500/10 text-green-500 border-green-500/20",
  utility: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const AdminEdgeFunctions = () => {
  const [tests, setTests] = useState<Record<string, FunctionTest>>(
    Object.fromEntries(edgeFunctionConfigs.map((fn) => [fn.name, { ...fn, status: "idle" }]))
  );
  const [isTestingAll, setIsTestingAll] = useState(false);

  const testFunction = async (fnName: string) => {
    const config = edgeFunctionConfigs.find(f => f.name === fnName);
    if (!config) return;

    setTests((prev) => ({
      ...prev,
      [fnName]: { ...prev[fnName], status: "running" },
    }));

    const startTime = Date.now();

    try {
      const response = await supabase.functions.invoke(fnName, {
        body: config.testPayload || { test: true },
      });

      const responseTime = Date.now() - startTime;
      
      // Determine if this is an expected error (e.g., 401 for auth-required endpoints)
      const isExpectedError = config.requiresAuth && response.error?.message?.includes("401");
      const isValidationError = response.error?.message?.includes("400") || response.error?.message?.includes("Missing");

      if (response.error) {
        setTests((prev) => ({
          ...prev,
          [fnName]: { 
            ...prev[fnName], 
            status: (isExpectedError || isValidationError) ? "expected_error" : "error", 
            error: response.error.message, 
            responseTime,
            statusCode: isExpectedError ? 401 : (isValidationError ? 400 : 500),
            response: JSON.stringify(response.error, null, 2)
          },
        }));
      } else {
        setTests((prev) => ({
          ...prev,
          [fnName]: { 
            ...prev[fnName], 
            status: "success", 
            responseTime,
            statusCode: 200,
            response: JSON.stringify(response.data, null, 2).slice(0, 200)
          },
        }));
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      setTests((prev) => ({
        ...prev,
        [fnName]: { ...prev[fnName], status: "error", error: error.message, responseTime },
      }));
    }
  };

  const testAllFunctions = async () => {
    setIsTestingAll(true);
    for (const fn of edgeFunctionConfigs) {
      await testFunction(fn.name);
    }
    setIsTestingAll(false);
    toast({ title: "Tests complete", description: `Tested ${edgeFunctionConfigs.length} edge functions` });
  };

  const testCategory = async (category: FunctionConfig["category"]) => {
    const categoryFunctions = edgeFunctionConfigs.filter(f => f.category === category);
    for (const fn of categoryFunctions) {
      await testFunction(fn.name);
    }
    toast({ title: "Category tests complete", description: `Tested ${categoryFunctions.length} ${category} functions` });
  };

  const getStatusIcon = (status: FunctionTest["status"]) => {
    switch (status) {
      case "running":
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "expected_error":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (test: FunctionTest) => {
    switch (test.status) {
      case "success":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">200 OK</Badge>;
      case "expected_error":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{test.statusCode} Expected</Badge>;
      case "error":
        return <Badge variant="destructive">{test.statusCode || "Error"}</Badge>;
      case "running":
        return <Badge variant="outline">Testing...</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not tested</Badge>;
    }
  };

  const categories = ["email", "ai", "webhook", "cron", "admin", "utility"] as const;
  
  const getSummary = () => {
    const allTests = Object.values(tests);
    return {
      total: allTests.length,
      success: allTests.filter(t => t.status === "success").length,
      expectedError: allTests.filter(t => t.status === "expected_error").length,
      error: allTests.filter(t => t.status === "error").length,
      idle: allTests.filter(t => t.status === "idle").length,
    };
  };

  const summary = getSummary();

  return (
    <AdminLayout title="Edge Functions" description="Monitor and test edge functions">
      <TooltipProvider>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-sm text-muted-foreground">Total Functions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-500">{summary.success}</div>
              <div className="text-sm text-muted-foreground">Passed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-500">{summary.expectedError}</div>
              <div className="text-sm text-muted-foreground">Expected Errors</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-500">{summary.error}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">{summary.idle}</div>
              <div className="text-sm text-muted-foreground">Not Tested</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <Button 
                key={cat} 
                variant="outline" 
                size="sm"
                onClick={() => testCategory(cat)}
                className="capitalize"
              >
                {categoryIcons[cat]}
                <span className="ml-1">{cat}</span>
              </Button>
            ))}
          </div>
          <Button onClick={testAllFunctions} disabled={isTestingAll}>
            <Play className="h-4 w-4 mr-2" />
            {isTestingAll ? "Testing..." : "Test All Functions"}
          </Button>
        </div>

        <Tabs defaultValue="table" className="w-full">
          <TabsList>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="grid">Grid View</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Edge Function Test Results
                </CardTitle>
                <CardDescription>
                  Detailed test results for all {edgeFunctionConfigs.length} edge functions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Function</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Auth</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Expected Behavior</TableHead>
                        <TableHead className="w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {edgeFunctionConfigs.map((config) => {
                        const test = tests[config.name];
                        return (
                          <TableRow key={config.name}>
                            <TableCell>{getStatusIcon(test.status)}</TableCell>
                            <TableCell className="font-mono text-sm">{config.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={categoryColors[config.category]}>
                                <span className="mr-1">{categoryIcons[config.category]}</span>
                                {config.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {config.requiresAuth ? (
                                <Badge variant="outline" className="text-orange-500 border-orange-500/20">Required</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-500 border-green-500/20">Public</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(test)}
                              {test.error && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs font-mono">{test.error}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {test.responseTime ? `${test.responseTime}ms` : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                              {config.expectedBehavior}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testFunction(config.name)}
                                disabled={test.status === "running"}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grid">
            <div className="space-y-6">
              {categories.map(category => {
                const categoryFunctions = edgeFunctionConfigs.filter(f => f.category === category);
                return (
                  <Card key={category}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg capitalize">
                        {categoryIcons[category]}
                        {category} Functions ({categoryFunctions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryFunctions.map((config) => {
                          const test = tests[config.name];
                          return (
                            <div
                              key={config.name}
                              className="p-4 border rounded-lg space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(test.status)}
                                  <span className="font-mono text-sm">{config.name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => testFunction(config.name)}
                                  disabled={test.status === "running"}
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(test)}
                                {test.responseTime && (
                                  <span className="text-xs text-muted-foreground">{test.responseTime}ms</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{config.expectedBehavior}</p>
                              {test.error && test.status === "error" && (
                                <p className="text-xs text-destructive truncate">{test.error}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </TooltipProvider>
    </AdminLayout>
  );
};

export default AdminEdgeFunctions;
