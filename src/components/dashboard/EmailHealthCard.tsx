import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface EmailHealthStats {
  deliveryRate: number;
  bouncedCount: number;
  complainedCount: number;
  totalSent: number;
}

export default function EmailHealthCard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmailHealthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmailHealth();
  }, []);

  const fetchEmailHealth = async () => {
    try {
      // Get recent email stats from outreach_logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logsData } = await supabase
        .from('outreach_logs')
        .select('status')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      // Get problem debtors
      const { data: problemDebtors } = await supabase
        .from('debtors')
        .select('email_status')
        .in('email_status', ['bounced', 'complained', 'invalid']);

      const totalSent = logsData?.length || 0;
      const delivered = logsData?.filter(l => 
        ['delivered', 'opened', 'clicked'].includes(l.status || '')
      ).length || 0;

      const bouncedCount = problemDebtors?.filter(d => d.email_status === 'bounced').length || 0;
      const complainedCount = problemDebtors?.filter(d => d.email_status === 'complained').length || 0;

      setStats({
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 100,
        bouncedCount,
        complainedCount,
        totalSent,
      });
    } catch (error) {
      console.error('Error fetching email health:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const hasIssues = stats.bouncedCount > 0 || stats.complainedCount > 0;
  const isHealthy = stats.deliveryRate >= 95;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Health
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => navigate('/reports/email-delivery')}
        >
          View Report
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</span>
          <span className="text-muted-foreground text-sm">Delivery Rate</span>
          {isHealthy ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 ml-auto" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500 ml-auto" />
          )}
        </div>

        {hasIssues && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {stats.bouncedCount + stats.complainedCount} emails need attention:
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 ml-6">
              {stats.bouncedCount > 0 && (
                <li>• {stats.bouncedCount} bounced {stats.bouncedCount === 1 ? 'address' : 'addresses'}</li>
              )}
              {stats.complainedCount > 0 && (
                <li>• {stats.complainedCount} spam {stats.complainedCount === 1 ? 'complaint' : 'complaints'}</li>
              )}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              onClick={() => navigate('/reports/email-delivery')}
            >
              Fix Email Issues
            </Button>
          </div>
        )}

        {!hasIssues && (
          <p className="text-sm text-muted-foreground">
            All email addresses are valid. Great work! 🎉
          </p>
        )}
      </CardContent>
    </Card>
  );
}
