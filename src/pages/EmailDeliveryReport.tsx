import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, CheckCircle, XCircle, AlertTriangle, Download, ExternalLink } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';

interface EmailActivity {
  id: string;
  recipient_email: string;
  subject: string;
  agent_name: string | null;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  debtor_id: string | null;
  debtors?: { name: string; company_name: string | null } | null;
}

interface DebtorWithEmailIssue {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
  email_status: string;
  last_bounce_reason: string | null;
}

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
}

export default function EmailDeliveryReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('7');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<EmailActivity[]>([]);
  const [problemEmails, setProblemEmails] = useState<DebtorWithEmailIssue[]>([]);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, bounced: 0, complained: 0 });
  const [chartData, setChartData] = useState<DailyStats[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = subDays(new Date(), parseInt(dateRange)).toISOString();

    // Fetch email activity
    const { data: activityData } = await supabase
      .from('email_activity_log')
      .select('*, debtors(name, company_name)')
      .gte('sent_at', startDate)
      .order('sent_at', { ascending: false })
      .limit(100);

    // Fetch problem emails (bounced/complained debtors)
    const { data: debtorData } = await supabase
      .from('debtors')
      .select('id, name, company_name, email, email_status, last_bounce_reason')
      .in('email_status', ['bounced', 'complained', 'invalid'])
      .order('email_status_updated_at', { ascending: false });

    // Calculate stats from outreach_logs for the date range
    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('status, sent_at')
      .gte('sent_at', startDate);

    if (activityData) {
      setActivities(activityData as EmailActivity[]);
    }

    if (debtorData) {
      setProblemEmails(debtorData);
    }

    // Calculate stats - cast status to string for comparison
    if (logsData) {
      const statsCalc = logsData.reduce(
        (acc, log) => {
          const status = log.status as string;
          acc.sent++;
          if (status === 'delivered' || status === 'opened' || status === 'clicked' || status === 'sent') {
            acc.delivered++;
          } else if (status === 'bounced') {
            acc.bounced++;
          } else if (status === 'complained') {
            acc.complained++;
          }
          return acc;
        },
        { sent: 0, delivered: 0, bounced: 0, complained: 0 }
      );
      setStats(statsCalc);

      // Build chart data
      const dailyMap: { [key: string]: DailyStats } = {};
      logsData.forEach((log) => {
        if (!log.sent_at) return;
        const status = log.status as string;
        const day = format(parseISO(log.sent_at), 'MMM d');
        if (!dailyMap[day]) {
          dailyMap[day] = { date: day, sent: 0, delivered: 0, bounced: 0 };
        }
        dailyMap[day].sent++;
        if (status === 'delivered' || status === 'opened' || status === 'clicked' || status === 'sent') {
          dailyMap[day].delivered++;
        } else if (status === 'bounced') {
          dailyMap[day].bounced++;
        }
      });
      setChartData(Object.values(dailyMap).reverse());
    }

    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Recipient', 'Subject', 'Agent', 'Status', 'Sent At'];
    const rows = activities.map((a) => [
      a.recipient_email,
      a.subject,
      a.agent_name || '',
      a.status,
      format(parseISO(a.sent_at), 'yyyy-MM-dd HH:mm'),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">✓ Delivered</Badge>;
      case 'bounced':
        return <Badge variant="destructive">Bounced</Badge>;
      case 'complained':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Spam</Badge>;
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : '0';

  return (
    <Layout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Email Delivery Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-sm text-muted-foreground">Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-sm text-muted-foreground">Delivered ({deliveryRate}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.bounced}</p>
                  <p className="text-sm text-muted-foreground">Bounced</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.complained}</p>
                  <p className="text-sm text-muted-foreground">Complaints</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Trend Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Trend</CardTitle>
              <CardDescription>Email delivery performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={2} name="Sent" />
                    <Line type="monotone" dataKey="delivered" stroke="hsl(142 76% 36%)" strokeWidth={2} name="Delivered" />
                    <Line type="monotone" dataKey="bounced" stroke="hsl(var(--destructive))" strokeWidth={2} name="Bounced" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Problem Emails */}
        {problemEmails.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-destructive">Problem Emails</CardTitle>
                  <CardDescription>These email addresses need attention</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problemEmails.map((debtor) => (
                    <TableRow key={debtor.id}>
                      <TableCell className="font-mono text-sm">{debtor.email}</TableCell>
                      <TableCell>{debtor.company_name || debtor.name}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {debtor.email_status === 'complained' ? '🚫 Opted Out' : '🔴 Bounced'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {debtor.last_bounce_reason || '-'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                          Fix
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest email sends and delivery events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No email activity in this period</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.slice(0, 20).map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(parseISO(activity.sent_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{activity.recipient_email}</p>
                          {activity.debtors && (
                            <p className="text-xs text-muted-foreground">
                              {activity.debtors.company_name || activity.debtors.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{activity.subject}</TableCell>
                      <TableCell>{getStatusBadge(activity.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
