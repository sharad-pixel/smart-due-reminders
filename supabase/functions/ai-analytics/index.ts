import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyticsContext {
  invoices: any[];
  payments: any[];
  debtors: any[];
  tasks: any[];
  activities: any[];
}

interface AnalysisResult {
  trends: TrendAnalysis[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  summary: string;
  riskAlerts: RiskAlert[];
}

interface TrendAnalysis {
  metric: string;
  direction: "up" | "down" | "stable";
  change: number;
  insight: string;
  timeframe: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  impact: string;
  accountId?: string;
  accountName?: string;
}

interface Prediction {
  metric: string;
  value: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

interface RiskAlert {
  severity: "critical" | "warning" | "info";
  message: string;
  accountId?: string;
  accountName?: string;
  amount?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { context, scope } = await req.json();
    
    // Get effective account ID for team members
    const { data: effectiveAccountId } = await supabase
      .rpc('get_effective_account_id', { p_user_id: user.id });
    
    const accountId = effectiveAccountId || user.id;

    // Fetch comprehensive analytics data
    const [
      invoicesRes,
      paymentsRes,
      debtorsRes,
      tasksRes,
      activitiesRes,
      digestRes
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, debtors(name, company_name, collections_health_score, collections_risk_score, health_tier, risk_tier)")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("payments")
        .select("*, debtors(name, company_name)")
        .eq("user_id", accountId)
        .order("payment_date", { ascending: false })
        .limit(200),
      supabase
        .from("debtors")
        .select("*")
        .eq("user_id", accountId)
        .eq("is_archived", false)
        .limit(100),
      supabase
        .from("collection_tasks")
        .select("*")
        .eq("user_id", accountId)
        .in("status", ["open", "in_progress"])
        .limit(100),
      supabase
        .from("collection_activities")
        .select("*")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("daily_digests")
        .select("*")
        .eq("user_id", accountId)
        .order("digest_date", { ascending: false })
        .limit(30),
    ]);

    const analyticsData: AnalyticsContext = {
      invoices: invoicesRes.data || [],
      payments: paymentsRes.data || [],
      debtors: debtorsRes.data || [],
      tasks: tasksRes.data || [],
      activities: activitiesRes.data || [],
    };

    const digests = digestRes.data || [];

    // Build analysis prompt
    const analysisPrompt = buildAnalysisPrompt(analyticsData, digests, scope, context);

    // Call AI for analysis
    if (!lovableApiKey) {
      // Fallback to rule-based analysis if no AI key
      const ruleBasedAnalysis = performRuleBasedAnalysis(analyticsData, digests);
      return new Response(JSON.stringify(ruleBasedAnalysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert financial analyst specializing in accounts receivable and collections analytics. 
            Analyze the provided data and return actionable insights in the specified JSON format.
            Be specific with account names and amounts. Focus on high-impact recommendations.
            Always provide concrete next steps, not generic advice.`
          },
          { role: "user", content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_analytics",
              description: "Provide comprehensive AR analytics including trends, recommendations, and predictions",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "2-3 sentence executive summary of AR health"
                  },
                  trends: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        metric: { type: "string" },
                        direction: { type: "string", enum: ["up", "down", "stable"] },
                        change: { type: "number" },
                        insight: { type: "string" },
                        timeframe: { type: "string" }
                      },
                      required: ["metric", "direction", "change", "insight", "timeframe"]
                    }
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        action: { type: "string" },
                        impact: { type: "string" },
                        accountName: { type: "string" }
                      },
                      required: ["priority", "action", "impact"]
                    }
                  },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        metric: { type: "string" },
                        value: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                        rationale: { type: "string" }
                      },
                      required: ["metric", "value", "confidence", "rationale"]
                    }
                  },
                  riskAlerts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["critical", "warning", "info"] },
                        message: { type: "string" },
                        accountName: { type: "string" },
                        amount: { type: "number" }
                      },
                      required: ["severity", "message"]
                    }
                  }
                },
                required: ["summary", "trends", "recommendations", "predictions", "riskAlerts"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_analytics" } }
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status);
      const ruleBasedAnalysis = performRuleBasedAnalysis(analyticsData, digests);
      return new Response(JSON.stringify(ruleBasedAnalysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const analysis = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback
    const ruleBasedAnalysis = performRuleBasedAnalysis(analyticsData, digests);
    return new Response(JSON.stringify(ruleBasedAnalysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("AI Analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildAnalysisPrompt(data: AnalyticsContext, digests: any[], scope?: string, context?: any): string {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Calculate key metrics
  const openInvoices = data.invoices.filter(i => i.status === "Open" || i.status === "InPaymentPlan");
  const totalOutstanding = openInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  
  const recentPayments = data.payments.filter(p => new Date(p.payment_date) >= thirtyDaysAgo);
  const totalCollected30d = recentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const overdueInvoices = openInvoices.filter(i => new Date(i.due_date) < now);
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

  const highRiskDebtors = data.debtors.filter(d => 
    d.risk_tier === "High" || d.risk_tier === "Critical" || 
    d.collections_risk_score > 60
  );

  const openTasks = data.tasks.filter(t => t.status === "open").length;
  const urgentTasks = data.tasks.filter(t => t.priority === "urgent" || t.priority === "high").length;

  // Aging distribution
  const agingBuckets = {
    current: 0,
    dpd_1_30: 0,
    dpd_31_60: 0,
    dpd_61_90: 0,
    dpd_91_plus: 0,
  };
  
  openInvoices.forEach(inv => {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) agingBuckets.current += inv.amount;
    else if (daysOverdue <= 30) agingBuckets.dpd_1_30 += inv.amount;
    else if (daysOverdue <= 60) agingBuckets.dpd_31_60 += inv.amount;
    else if (daysOverdue <= 90) agingBuckets.dpd_61_90 += inv.amount;
    else agingBuckets.dpd_91_plus += inv.amount;
  });

  // Build digest trend data
  let trendData = "";
  if (digests.length >= 2) {
    const latest = digests[0];
    const previous = digests[1];
    trendData = `
Daily Digest Trends:
- Latest health score: ${latest.health_score || 'N/A'} (${latest.health_label || 'Unknown'})
- Previous health score: ${previous.health_score || 'N/A'}
- Payments today: $${latest.payments_collected_today || 0}
- Payments last 7 days: $${latest.payments_collected_last_7_days || 0}
- Open tasks: ${latest.open_tasks_count || 0}
- Overdue tasks: ${latest.overdue_tasks_count || 0}
`;
  }

  // Top accounts by outstanding
  const topAccounts = [...data.debtors]
    .sort((a, b) => (b.total_open_balance || 0) - (a.total_open_balance || 0))
    .slice(0, 10)
    .map(d => `  - ${d.company_name || d.name}: $${(d.total_open_balance || 0).toLocaleString()} outstanding, ${d.health_tier || 'Unknown'} health, ${d.risk_tier || 'Unknown'} risk`);

  return `
Analyze the following accounts receivable data and provide actionable insights:

CURRENT AR SNAPSHOT:
- Total Outstanding: $${totalOutstanding.toLocaleString()}
- Total Overdue: $${totalOverdue.toLocaleString()} (${overdueInvoices.length} invoices)
- Collections Last 30 Days: $${totalCollected30d.toLocaleString()} (${recentPayments.length} payments)
- High-Risk Accounts: ${highRiskDebtors.length}
- Open Tasks: ${openTasks} (${urgentTasks} urgent/high priority)
- Total Accounts: ${data.debtors.length}

AGING DISTRIBUTION:
- Current: $${agingBuckets.current.toLocaleString()}
- 1-30 DPD: $${agingBuckets.dpd_1_30.toLocaleString()}
- 31-60 DPD: $${agingBuckets.dpd_31_60.toLocaleString()}
- 61-90 DPD: $${agingBuckets.dpd_61_90.toLocaleString()}
- 91+ DPD: $${agingBuckets.dpd_91_plus.toLocaleString()}

${trendData}

TOP ACCOUNTS BY OUTSTANDING:
${topAccounts.join('\n')}

HIGH-RISK ACCOUNTS:
${highRiskDebtors.slice(0, 5).map(d => `  - ${d.company_name || d.name}: Risk Score ${d.collections_risk_score || 'N/A'}, $${(d.total_open_balance || 0).toLocaleString()}`).join('\n')}

RECENT ACTIVITY:
- Collection activities last 7 days: ${data.activities.filter(a => new Date(a.created_at) >= sevenDaysAgo).length}
- Tasks completed last 7 days: ${data.tasks.filter(t => t.status === "done" && t.completed_at && new Date(t.completed_at) >= sevenDaysAgo).length}

${scope ? `ANALYSIS FOCUS: ${scope}` : ''}
${context ? `ADDITIONAL CONTEXT: ${JSON.stringify(context)}` : ''}

Provide analysis with:
1. Summary: 2-3 sentence executive overview
2. Trends: Key metric changes with direction and insights
3. Recommendations: Prioritized actions with specific account names where applicable
4. Predictions: Forecasted outcomes with confidence levels
5. Risk Alerts: Critical issues requiring immediate attention
`;
}

function performRuleBasedAnalysis(data: AnalyticsContext, digests: any[]): AnalysisResult {
  const now = new Date();
  const trends: TrendAnalysis[] = [];
  const recommendations: Recommendation[] = [];
  const predictions: Prediction[] = [];
  const riskAlerts: RiskAlert[] = [];

  // Calculate metrics
  const openInvoices = data.invoices.filter(i => i.status === "Open" || i.status === "InPaymentPlan");
  const totalOutstanding = openInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const overdueInvoices = openInvoices.filter(i => new Date(i.due_date) < now);
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

  // Build trends from digests
  if (digests.length >= 2) {
    const latest = digests[0];
    const previous = digests[1];
    
    if (latest.health_score && previous.health_score) {
      const change = latest.health_score - previous.health_score;
      trends.push({
        metric: "Collections Health Score",
        direction: change > 0 ? "up" : change < 0 ? "down" : "stable",
        change: Math.abs(change),
        insight: change > 0 
          ? "Health score improving, collection efforts are effective"
          : change < 0 
          ? "Health score declining, review collection strategy"
          : "Health score stable",
        timeframe: "Daily"
      });
    }

    if (latest.payments_collected_last_7_days && previous.payments_collected_last_7_days) {
      const change = ((latest.payments_collected_last_7_days - previous.payments_collected_last_7_days) / 
        (previous.payments_collected_last_7_days || 1)) * 100;
      trends.push({
        metric: "Weekly Collections",
        direction: change > 5 ? "up" : change < -5 ? "down" : "stable",
        change: Math.round(Math.abs(change)),
        insight: `$${(latest.payments_collected_last_7_days || 0).toLocaleString()} collected in the last 7 days`,
        timeframe: "7 days"
      });
    }
  }

  // Overdue trend
  const overduePercent = totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0;
  trends.push({
    metric: "Overdue Percentage",
    direction: overduePercent > 30 ? "up" : overduePercent < 10 ? "down" : "stable",
    change: Math.round(overduePercent),
    insight: `${Math.round(overduePercent)}% of outstanding AR is overdue`,
    timeframe: "Current"
  });

  // Generate recommendations
  const highRiskDebtors = data.debtors.filter(d => 
    d.risk_tier === "High" || d.risk_tier === "Critical"
  );

  highRiskDebtors.slice(0, 3).forEach(debtor => {
    recommendations.push({
      priority: "high",
      action: `Escalate collection efforts for ${debtor.company_name || debtor.name}`,
      impact: `$${(debtor.total_open_balance || 0).toLocaleString()} at risk`,
      accountId: debtor.id,
      accountName: debtor.company_name || debtor.name
    });
  });

  const urgentTasks = data.tasks.filter(t => t.priority === "urgent" || t.priority === "high");
  if (urgentTasks.length > 5) {
    recommendations.push({
      priority: "high",
      action: "Review and prioritize task queue - high volume of urgent tasks",
      impact: `${urgentTasks.length} tasks need attention`
    });
  }

  // Generate predictions
  const avgDailyCollections = data.payments.length > 0 
    ? data.payments.reduce((sum, p) => sum + (p.amount || 0), 0) / 30 
    : 0;

  predictions.push({
    metric: "30-Day Collection Forecast",
    value: `$${Math.round(avgDailyCollections * 30).toLocaleString()}`,
    confidence: data.payments.length >= 20 ? "medium" : "low",
    rationale: "Based on recent payment velocity"
  });

  if (overduePercent > 25) {
    predictions.push({
      metric: "Write-off Risk",
      value: "Elevated",
      confidence: "medium",
      rationale: `${Math.round(overduePercent)}% overdue rate suggests increased write-off risk in 91+ DPD bucket`
    });
  }

  // Generate risk alerts
  if (overduePercent > 40) {
    riskAlerts.push({
      severity: "critical",
      message: `Overdue AR at ${Math.round(overduePercent)}% - immediate action required`,
      amount: overdueAmount
    });
  }

  highRiskDebtors.filter(d => (d.total_open_balance || 0) > 10000).slice(0, 3).forEach(debtor => {
    riskAlerts.push({
      severity: "warning",
      message: `High-risk account with significant balance`,
      accountId: debtor.id,
      accountName: debtor.company_name || debtor.name,
      amount: debtor.total_open_balance || 0
    });
  });

  const summary = `AR portfolio shows $${totalOutstanding.toLocaleString()} outstanding with ${Math.round(overduePercent)}% overdue. ${highRiskDebtors.length} accounts flagged as high-risk. ${recommendations.length > 0 ? 'Immediate attention needed on priority recommendations.' : 'Collection health is stable.'}`;

  return { summary, trends, recommendations, predictions, riskAlerts };
}
