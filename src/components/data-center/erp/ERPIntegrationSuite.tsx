import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  Clock,
  RefreshCw,
  Settings,
  ArrowRight,
  ArrowLeftRight,
  Shield,
  Webhook,
  Calendar,
  Play,
  Pause,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Globe,
  Lock,
  Zap,
} from "lucide-react";
import { NetSuiteIcon, SageIcon } from "@/components/icons/ERPIcons";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncObject {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  direction: "pull" | "push" | "bidirectional";
  lastSynced: string | null;
  recordCount: number;
  status: "idle" | "syncing" | "error" | "disabled";
}

interface ERPConnection {
  id: string;
  name: string;
  provider: "netsuite" | "sage";
  status: "connected" | "disconnected" | "pending" | "error";
  environment: "sandbox" | "production";
  instanceUrl: string | null;
  lastSyncAt: string | null;
  syncMethod: "webhook" | "scheduled" | "manual";
  syncFrequency: string;
  objects: SyncObject[];
}

// ─── Default Object Templates ─────────────────────────────────────────────────

const defaultObjects: SyncObject[] = [
  {
    id: "customers",
    label: "Customers & Contacts",
    description: "Company profiles, billing contacts, payment terms",
    icon: <Users className="h-4 w-4" />,
    enabled: true,
    direction: "pull",
    lastSynced: null,
    recordCount: 0,
    status: "idle",
  },
  {
    id: "invoices",
    label: "Invoices & Line Items",
    description: "Open/paid invoices, amounts, due dates, aging",
    icon: <FileText className="h-4 w-4" />,
    enabled: true,
    direction: "pull",
    lastSynced: null,
    recordCount: 0,
    status: "idle",
  },
  {
    id: "payments",
    label: "Payments & Credits",
    description: "Payment transactions, credit memos, refunds",
    icon: <DollarSign className="h-4 w-4" />,
    enabled: true,
    direction: "pull",
    lastSynced: null,
    recordCount: 0,
    status: "idle",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ERPIntegrationSuite = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProvider, setSelectedProvider] = useState<"netsuite" | "sage" | null>(null);
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [configuring, setConfiguring] = useState(false);

  // ── Placeholder config state ────────────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    instanceUrl: "",
    accountId: "",
    environment: "sandbox" as "sandbox" | "production",
    syncMethod: "scheduled" as "webhook" | "scheduled" | "manual",
    syncFrequency: "daily",
    enabledObjects: ["customers", "invoices", "payments"] as string[],
  });

  const providers = [
    {
      id: "netsuite" as const,
      name: "Oracle NetSuite",
      description: "Full AR ledger, journal entries, customer records, and payment history",
      icon: <NetSuiteIcon className="h-10 w-10" />,
      features: ["SuiteScript REST API", "Token-Based Auth", "Saved Search Sync", "Real-time Webhooks"],
      objects: ["Customers", "Invoices", "Payments", "Credit Memos", "Journal Entries"],
      color: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/60",
    },
    {
      id: "sage" as const,
      name: "Sage Intacct",
      description: "Multi-entity AR, dimensional reporting, payment allocations",
      icon: <SageIcon className="h-10 w-10" />,
      features: ["REST API v4", "OAuth 2.0", "Multi-Entity Support", "Scheduled Polling"],
      objects: ["Customers", "AR Invoices", "Payments", "Adjustments", "Aging Reports"],
      color: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/60",
    },
  ];

  const handleStartConfig = (provider: "netsuite" | "sage") => {
    setSelectedProvider(provider);
    setConfiguring(true);
    setActiveTab("configure");
  };

  const handleSaveConnection = () => {
    if (!selectedProvider) return;
    const providerInfo = providers.find((p) => p.id === selectedProvider);

    const newConnection: ERPConnection = {
      id: crypto.randomUUID(),
      name: providerInfo?.name || selectedProvider,
      provider: selectedProvider,
      status: "pending",
      environment: configForm.environment,
      instanceUrl: configForm.instanceUrl || null,
      lastSyncAt: null,
      syncMethod: configForm.syncMethod,
      syncFrequency: configForm.syncFrequency,
      objects: defaultObjects.map((obj) => ({
        ...obj,
        enabled: configForm.enabledObjects.includes(obj.id),
        status: configForm.enabledObjects.includes(obj.id) ? "idle" : "disabled",
      })),
    };

    setConnections((prev) => [...prev, newConnection]);
    setConfiguring(false);
    setSelectedProvider(null);
    setActiveTab("connections");
    toast.success(`${providerInfo?.name} connection created`, {
      description: "Complete authentication to start syncing data.",
    });
  };

  const handleTriggerSync = (connectionId: string) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connectionId
          ? {
              ...c,
              status: "connected",
              lastSyncAt: new Date().toISOString(),
              objects: c.objects.map((o) =>
                o.enabled ? { ...o, status: "syncing" as const } : o
              ),
            }
          : c
      )
    );
    toast.info("Manual sync triggered", { description: "This is a UI preview — API integration coming soon." });

    // Simulate sync completing
    setTimeout(() => {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? {
                ...c,
                objects: c.objects.map((o) =>
                  o.status === "syncing" ? { ...o, status: "idle" as const, lastSynced: new Date().toISOString(), recordCount: Math.floor(Math.random() * 500) + 10 } : o
                ),
              }
            : c
        )
      );
      toast.success("Sync simulation complete");
    }, 3000);
  };

  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <Globe className="h-4 w-4" />
            Available ERPs
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Connections
            {connections.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {connections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="configure" className="gap-2" disabled={!configuring}>
            <Settings className="h-4 w-4" />
            Configure
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((provider) => {
              const isConnected = connections.some((c) => c.provider === provider.id);
              return (
                <Card key={provider.id} className={`relative overflow-hidden transition-all hover:shadow-md ${isConnected ? "border-primary/40" : "border-dashed hover:border-primary/30"}`}>
                  {isConnected && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">{provider.icon}</div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">{provider.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1.5">
                      {provider.features.map((f) => (
                        <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0.5 font-normal">
                          {f}
                        </Badge>
                      ))}
                    </div>

                    {/* Sync Objects */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Syncable Objects</p>
                      <div className="flex flex-wrap gap-1.5">
                        {provider.objects.map((obj) => (
                          <Badge key={obj} variant="secondary" className="text-xs font-normal gap-1">
                            <ArrowRight className="h-2.5 w-2.5" />
                            {obj}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <Button
                      className="w-full gap-2"
                      variant={isConnected ? "outline" : "default"}
                      onClick={() => handleStartConfig(provider.id)}
                    >
                      {isConnected ? (
                        <>
                          <Settings className="h-4 w-4" />
                          Manage Connection
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Connect {provider.name}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Sync Method Overview */}
          <Card className="border-muted">
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Webhook className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Webhook Push</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receive real-time events as changes happen in your ERP. Lowest latency for payment and invoice updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Scheduled Pull</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automated polling at configurable intervals — hourly, daily, or custom. Reliable batch sync.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Manual Trigger</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      On-demand sync with a single click. Perfect for initial data loads and testing.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONNECTIONS TAB ──────────────────────────────────────────── */}
        <TabsContent value="connections" className="space-y-4 mt-4">
          {connections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <ArrowLeftRight className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1">No ERP Connections</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect NetSuite or Sage to start syncing your AR data into Recouply
                </p>
                <Button onClick={() => setActiveTab("overview")} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          ) : (
            connections.map((conn) => {
              const providerInfo = providers.find((p) => p.id === conn.provider);
              return (
                <Card key={conn.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {providerInfo?.icon}
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {conn.name}
                            <Badge
                              variant="outline"
                              className={
                                conn.status === "connected"
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                                  : conn.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                                  : conn.status === "error"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {conn.status === "connected" && <CheckCircle className="h-3 w-3 mr-1" />}
                              {conn.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                              {conn.status === "error" && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {conn.environment === "production" ? "🟢 Production" : "🟡 Sandbox"}
                            </Badge>
                            <span>•</span>
                            <span className="capitalize">{conn.syncMethod} sync</span>
                            {conn.syncMethod === "scheduled" && <span>• {conn.syncFrequency}</span>}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTriggerSync(conn.id)}
                          className="gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync Now
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Object Sync Status */}
                    <div className="grid gap-2">
                      {conn.objects
                        .filter((o) => o.enabled)
                        .map((obj) => (
                          <div
                            key={obj.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-md bg-background flex items-center justify-center border">
                                {obj.icon}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{obj.label}</p>
                                <p className="text-xs text-muted-foreground">{obj.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <div>
                                <p className="text-sm font-semibold">{obj.recordCount.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {obj.lastSynced
                                    ? `Synced ${new Date(obj.lastSynced).toLocaleDateString()}`
                                    : "Never synced"}
                                </p>
                              </div>
                              {obj.status === "syncing" ? (
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              ) : obj.status === "error" ? (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Webhook URL (if webhook mode) */}
                    {conn.syncMethod === "webhook" && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium">Webhook Endpoint</p>
                        </div>
                        <code className="text-xs text-muted-foreground break-all block bg-background p-2 rounded border">
                          https://kguurazunazhhrhasahd.supabase.co/functions/v1/erp-webhook/{conn.provider}
                        </code>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Configure this URL in your {conn.name} webhook settings to receive real-time events.
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                          <Settings className="h-3 w-3" />
                          Field Mapping
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                          <Shield className="h-3 w-3" />
                          Auth Settings
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 text-xs">
                        Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── CONFIGURE TAB ────────────────────────────────────────────── */}
        <TabsContent value="configure" className="space-y-4 mt-4">
          {configuring && selectedProvider ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {providers.find((p) => p.id === selectedProvider)?.icon}
                  <div>
                    <CardTitle className="text-lg">
                      Configure {providers.find((p) => p.id === selectedProvider)?.name}
                    </CardTitle>
                    <CardDescription>
                      Set up your connection, sync preferences, and select objects to sync
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Connection Details
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Instance URL / Subdomain</Label>
                      <Input
                        placeholder={selectedProvider === "netsuite" ? "https://12345.suitetalk.api.netsuite.com" : "https://api.intacct.com"}
                        value={configForm.instanceUrl}
                        onChange={(e) => setConfigForm((f) => ({ ...f, instanceUrl: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account / Company ID</Label>
                      <Input
                        placeholder={selectedProvider === "netsuite" ? "TSTDRV12345" : "MyCompany-ID"}
                        value={configForm.accountId}
                        onChange={(e) => setConfigForm((f) => ({ ...f, accountId: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select
                      value={configForm.environment}
                      onValueChange={(v) => setConfigForm((f) => ({ ...f, environment: v as "sandbox" | "production" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">🟡 Sandbox (Testing)</SelectItem>
                        <SelectItem value="production">🟢 Production (Live Data)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Sync Preferences */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    Sync Preferences
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sync Method</Label>
                      <Select
                        value={configForm.syncMethod}
                        onValueChange={(v) => setConfigForm((f) => ({ ...f, syncMethod: v as "webhook" | "scheduled" | "manual" }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webhook">⚡ Webhook Push (Real-time)</SelectItem>
                          <SelectItem value="scheduled">📅 Scheduled Pull (Polling)</SelectItem>
                          <SelectItem value="manual">🖱️ Manual Trigger Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {configForm.syncMethod === "scheduled" && (
                      <div className="space-y-2">
                        <Label>Sync Frequency</Label>
                        <Select
                          value={configForm.syncFrequency}
                          onValueChange={(v) => setConfigForm((f) => ({ ...f, syncFrequency: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="every_6h">Every 6 Hours</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Object Selection */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    Data Objects to Sync
                  </h3>
                  <div className="space-y-3">
                    {defaultObjects.map((obj) => (
                      <div
                        key={obj.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          configForm.enabledObjects.includes(obj.id)
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/30 border-border"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-background flex items-center justify-center border">
                            {obj.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{obj.label}</p>
                            <p className="text-xs text-muted-foreground">{obj.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={configForm.enabledObjects.includes(obj.id)}
                          onCheckedChange={(checked) => {
                            setConfigForm((f) => ({
                              ...f,
                              enabledObjects: checked
                                ? [...f.enabledObjects, obj.id]
                                : f.enabledObjects.filter((id) => id !== obj.id),
                            }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfiguring(false);
                      setSelectedProvider(null);
                      setActiveTab("overview");
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => toast.info("Test connection coming soon")}>
                      Test Connection
                    </Button>
                    <Button onClick={handleSaveConnection} className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Save & Connect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Settings className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1">No Configuration in Progress</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select an ERP from the Available ERPs tab to start configuring
                </p>
                <Button onClick={() => setActiveTab("overview")} variant="outline" className="gap-2">
                  <ChevronRight className="h-4 w-4" />
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
