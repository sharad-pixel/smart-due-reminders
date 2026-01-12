import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Send, CheckCircle, XCircle, AlertTriangle, Download, ExternalLink, Search, Filter, RefreshCw } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  error_message: string | null;
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
  failed: number;
}

export default function EmailDeliveryReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [dateRange, setDateRange] = useState(searchParams.get('days') || '7');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<EmailActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<EmailActivity[]>([]);
  const [problemEmails, setProblemEmails] = useState<DebtorWithEmailIssue[]>([]);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, bounced: 0, failed: 0, complained: 0 });
  const [chartData, setChartData] = useState<DailyStats[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  useEffect(() => {
    // Apply filters
    let filtered = [...activities];
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'failed') {
        filtered = filtered.filter(a => a.status === 'failed' || a.status === 'bounced' || a.status === 'complained');
      } else {
        filtered = filtered.filter(a => a.status === statusFilter);
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.recipient_email?.toLowerCase().includes(query) ||
        a.subject?.toLowerCase().includes(query) ||
        a.agent_name?.toLowerCase().includes(query) ||
        a.debtors?.company_name?.toLowerCase().includes(query) ||
        a.debtors?.name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredActivities(filtered);
    
    // Update URL params
    const params = new URLSearchParams();
    if (dateRange !== '7') params.set('days', dateRange);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);
    setSearchParams(params, { replace: true });
  }, [activities, statusFilter, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = subDays(new Date(), parseInt(dateRange)).toISOString();

    // Fetch from outreach_log for complete activity including errors
    const { data: outreachLogData } = await supabase
      .from('outreach_log')
      .select('*, debtors(name, company_name)')
      .gte('sent_at', startDate)
      .order('sent_at', { ascending: false })
      .limit(500);

    // Also fetch email activity log for additional context
    const { data: activityData } = await supabase
      .from('email_activity_log')
      .select('*, debtors(name, company_name)')
      .gte('sent_at', startDate)
      .order('sent_at', { ascending: false })
      .limit(200);

    // Merge and dedupe activities
    const mergedActivities: EmailActivity[] = [];
    const seenIds = new Set<string>();
    
    // Add outreach logs first (priority)
    (outreachLogData || []).forEach((log: any) => {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id);
        mergedActivities.push({
          id: log.id,
          recipient_email: log.recipient_email,
          subject: log.subject,
          agent_name: log.agent_name,
          status: log.status,
          sent_at: log.sent_at,
          delivered_at: log.delivered_at,
          debtor_id: log.debtor_id,
          error_message: log.error_message,
          debtors: log.debtors
        });
      }
    });
    
    // Add activity logs that aren't duplicates
    (activityData || []).forEach((log: any) => {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id);
        mergedActivities.push({
          id: log.id,
          recipient_email: log.recipient_email,
          subject: log.subject,
          agent_name: log.agent_name,
          status: log.status,
          sent_at: log.sent_at,
          delivered_at: log.delivered_at,
          debtor_id: log.debtor_id,
          error_message: null,
          debtors: log.debtors
        });
      }
    });

    // Fetch problem emails (bounced/complained debtors)
    const { data: debtorData } = await supabase
      .from('debtors')
      .select('id, name, company_name, email, email_status, last_bounce_reason')
      .in('email_status', ['bounced', 'complained', 'invalid'])
      .order('email_status_updated_at', { ascending: false });

    // Calculate stats from outreach_logs for the date range
    const { data: logsData } = await supabase
      .from('outreach_log')
      .select('status, sent_at')
      .gte('sent_at', startDate);

    setActivities(mergedActivities);

    if (debtorData) {
      setProblemEmails(debtorData);
    }

    // Calculate stats - include failed status
    if (logsData) {
      const statsCalc = logsData.reduce(
        (acc, log) => {
          const status = log.status as string;
          acc.sent++;
          if (status === 'delivered' || status === 'opened' || status === 'clicked') {
            acc.delivered++;
          } else if (status === 'sent') {
            // Sent but not yet delivered
          } else if (status === 'bounced') {
            acc.bounced++;
          } else if (status === 'failed') {
            acc.failed++;
          } else if (status === 'complained') {
            acc.complained++;
          }
          return acc;
        },
        { sent: 0, delivered: 0, bounced: 0, failed: 0, complained: 0 }
      );
      setStats(statsCalc);

      // Build chart data
      const dailyMap: { [key: string]: DailyStats } = {};
      logsData.forEach((log) => {
        if (!log.sent_at) return;
        const status = log.status as string;
        const day = format(parseISO(log.sent_at), 'MMM d');
        if (!dailyMap[day]) {
          dailyMap[day] = { date: day, sent: 0, delivered: 0, bounced: 0, failed: 0 };
        }
        dailyMap[day].sent++;
        if (status === 'delivered' || status === 'opened' || status === 'clicked') {
          dailyMap[day].delivered++;
        } else if (status === 'bounced') {
          dailyMap[day].bounced++;
        } else if (status === 'failed') {
          dailyMap[day].failed++;
        }
      });
      setChartData(Object.values(dailyMap).reverse());
    }

    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Recipient', 'Subject', 'Agent', 'Status', 'Error', 'Sent At'];
    const rows = filteredActivities.map((a) => [
      a.recipient_email,
      a.subject?.replace(/,/g, ';') || '',
      a.agent_name || '',
      a.status,
      a.error_message?.replace(/,/g, ';') || '',
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
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'complained':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Spam</Badge>;
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : '0';
  const totalFailed = stats.bounced + stats.failed + stats.complained;

  return (
    <Layout>
      <div className="container py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Email Delivery Report</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.sent}</p>
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('delivered')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-muted-foreground">Delivered ({deliveryRate}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('failed')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('bounced')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.bounced}</p>
                  <p className="text-xs text-muted-foreground">Bounced</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('complained')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.complained}</p>
                  <p className="text-xs text-muted-foreground">Complaints</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, subject, account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="complained">Complained</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Trend Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery Trend</CardTitle>
              <CardDescription>Email delivery performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={2} name="Sent" />
                    <Line type="monotone" dataKey="delivered" stroke="hsl(142 76% 36%)" strokeWidth={2} name="Delivered" />
                    <Line type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" strokeWidth={2} name="Failed" />
                    <Line type="monotone" dataKey="bounced" stroke="hsl(0 84% 60%)" strokeWidth={2} name="Bounced" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Problem Emails */}
        {problemEmails.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-destructive">Problem Emails</CardTitle>
                  <CardDescription>{problemEmails.length} addresses need attention</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Reason</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {problemEmails.slice(0, 10).map((debtor) => (
                      <TableRow key={debtor.id}>
                        <TableCell className="font-mono text-xs">{debtor.email}</TableCell>
                        <TableCell className="text-sm">{debtor.company_name || debtor.name}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {debtor.email_status === 'complained' ? 'Opted Out' : debtor.email_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate hidden md:table-cell">
                          {debtor.last_bounce_reason || '-'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                            Fix
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {problemEmails.length > 10 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  +{problemEmails.length - 10} more problem emails
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Activity Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Email Activity</CardTitle>
                <CardDescription>
                  {filteredActivities.length} of {activities.length} emails
                  {statusFilter !== 'all' && ` (filtered by ${statusFilter})`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No email activity matches your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="hidden md:table-cell">Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.slice(0, 50).map((activity) => (
                      <TableRow 
                        key={activity.id}
                        className={activity.debtor_id ? 'cursor-pointer hover:bg-muted/50' : ''}
                        onClick={() => activity.debtor_id && navigate(`/debtors/${activity.debtor_id}`)}
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                          {format(parseISO(activity.sent_at), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-xs">{activity.recipient_email}</p>
                            {activity.debtors && (
                              <p className="text-xs text-muted-foreground">
                                {activity.debtors.company_name || activity.debtors.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm hidden md:table-cell">
                          {activity.subject}
                        </TableCell>
                        <TableCell>{getStatusBadge(activity.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-destructive hidden lg:table-cell">
                          {activity.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredActivities.length > 50 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Showing 50 of {filteredActivities.length} results
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}