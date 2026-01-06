import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Mail, Users, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PersonaAvatar } from "./PersonaAvatar";

const AGENT_CONFIG = [
  { name: 'Sam', bucket: 'dpd_1_30', range: '1-30 days', tone: 'Friendly' },
  { name: 'James', bucket: 'dpd_31_60', range: '31-60 days', tone: 'Professional' },
  { name: 'Katy', bucket: 'dpd_61_90', range: '61-90 days', tone: 'Firm' },
  { name: 'Jimmy', bucket: 'dpd_91_120', range: '91-120 days', tone: 'Serious' },
  { name: 'Troy', bucket: 'dpd_121_150', range: '121-150 days', tone: 'Final Warning' },
  { name: 'Rocco', bucket: 'dpd_150_plus', range: '151+ days', tone: 'Collections' },
];

export function OutreachStatusDashboard() {
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch outreach stats
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['outreach-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Active outreach count
      const { count: activeCount } = await supabase
        .from('invoice_outreach')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Emails sent today
      const today = new Date().toISOString().split('T')[0];
      const { count: sentToday } = await supabase
        .from('outreach_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('sent_at', today);

      // Emails sent this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: sentThisWeek } = await supabase
        .from('outreach_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('sent_at', weekAgo.toISOString());

      // Stats by agent
      const { data: agentStats } = await supabase
        .from('invoice_outreach')
        .select('current_bucket')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { data: emailsByAgent } = await supabase
        .from('outreach_log')
        .select('agent_name')
        .eq('user_id', user.id)
        .eq('status', 'sent');

      // Count invoices per bucket
      const invoicesByBucket: Record<string, number> = {};
      agentStats?.forEach(s => {
        invoicesByBucket[s.current_bucket] = (invoicesByBucket[s.current_bucket] || 0) + 1;
      });

      // Count emails per agent
      const emailsByAgentName: Record<string, number> = {};
      emailsByAgent?.forEach(e => {
        emailsByAgentName[e.agent_name] = (emailsByAgentName[e.agent_name] || 0) + 1;
      });

      return {
        activeCount: activeCount || 0,
        sentToday: sentToday || 0,
        sentThisWeek: sentThisWeek || 0,
        invoicesByBucket,
        emailsByAgentName,
      };
    },
  });

  const handleRunOutreach = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-outreach-daily');
      
      if (error) throw error;
      
      toast.success(`Outreach processed: ${data.emails_sent || 0} emails sent`);
      refetch();
    } catch (error: any) {
      console.error('Error running outreach:', error);
      toast.error('Failed to run outreach: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outreach Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Outreach Status
          </CardTitle>
          <Button 
            onClick={handleRunOutreach} 
            disabled={isProcessing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing...' : 'Run Outreach Now'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">{stats?.activeCount || 0}</div>
              <div className="text-sm text-muted-foreground">Active Invoices in Outreach</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats?.sentToday || 0}</div>
              <div className="text-sm text-muted-foreground">Emails Sent Today</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats?.sentThisWeek || 0}</div>
              <div className="text-sm text-muted-foreground">Emails Sent This Week</div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Automated outreach runs daily at 9:00 AM UTC</span>
          </div>
        </CardContent>
      </Card>

      {/* Agents by Bucket */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agents by Bucket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {AGENT_CONFIG.map((agent) => {
              const invoiceCount = stats?.invoicesByBucket?.[agent.bucket] || 0;
              const emailCount = stats?.emailsByAgentName?.[agent.name] || 0;
              
              return (
                <div 
                  key={agent.name}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PersonaAvatar 
                      persona={agent.name.toLowerCase()} 
                      size="sm" 
                    />
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.range} • {agent.tone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">{invoiceCount}</div>
                      <div className="text-xs text-muted-foreground">invoices</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={emailCount > 0 ? "default" : "secondary"}>
                        {emailCount} sent
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
