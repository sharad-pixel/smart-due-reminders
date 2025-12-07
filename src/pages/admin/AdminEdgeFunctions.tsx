import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Play, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FunctionTest {
  name: string;
  status: "idle" | "running" | "success" | "error";
  responseTime?: number;
  error?: string;
}

const edgeFunctions = [
  "send-email",
  "send-ai-draft",
  "calculate-payment-score",
  "risk-engine",
  "daily-digest-runner",
  "resend-inbound-tasks",
  "process-inbound-ai",
  "generate-bucket-drafts",
  "admin-list-users",
  "admin-update-user",
];

const AdminEdgeFunctions = () => {
  const [tests, setTests] = useState<Record<string, FunctionTest>>(
    Object.fromEntries(edgeFunctions.map((fn) => [fn, { name: fn, status: "idle" }]))
  );

  const testFunction = async (fnName: string) => {
    setTests((prev) => ({
      ...prev,
      [fnName]: { ...prev[fnName], status: "running" },
    }));

    const startTime = Date.now();

    try {
      // Just check if function responds
      const { error } = await supabase.functions.invoke(fnName, {
        body: { test: true },
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        setTests((prev) => ({
          ...prev,
          [fnName]: { ...prev[fnName], status: "error", error: error.message, responseTime },
        }));
      } else {
        setTests((prev) => ({
          ...prev,
          [fnName]: { ...prev[fnName], status: "success", responseTime },
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
    for (const fn of edgeFunctions) {
      await testFunction(fn);
    }
    toast({ title: "Tests complete", description: "All edge functions tested" });
  };

  const getStatusIcon = (status: FunctionTest["status"]) => {
    switch (status) {
      case "running":
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <AdminLayout title="Edge Functions" description="Monitor and test edge functions">
      <div className="flex justify-end mb-4">
        <Button onClick={testAllFunctions}>
          <Play className="h-4 w-4 mr-2" />
          Test All Functions
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Edge Functions ({edgeFunctions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {edgeFunctions.map((fn) => {
              const test = tests[fn];
              return (
                <div
                  key={fn}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <p className="font-medium text-sm">{fn}</p>
                      {test.responseTime && (
                        <p className="text-xs text-muted-foreground">{test.responseTime}ms</p>
                      )}
                      {test.error && (
                        <p className="text-xs text-destructive truncate max-w-32">{test.error}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testFunction(fn)}
                    disabled={test.status === "running"}
                  >
                    Test
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminEdgeFunctions;
