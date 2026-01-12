import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Brain, 
  Mail, 
  MessageSquare, 
  CheckCircle, 
  Zap, 
  BarChart3, 
  Clock, 
  Target, 
  Inbox, 
  ListTodo,
  Bot,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Users,
  AlertTriangle,
  Lightbulb,
  FileText,
  Activity
} from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import CollectionIntelligenceShowcase from "@/components/marketing/CollectionIntelligenceShowcase";

const CollectionIntelligence = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto text-center max-w-5xl">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8 border border-primary/20">
            <Brain className="h-5 w-5" />
            <span>Collection Intelligence Platform</span>
            <Zap className="h-4 w-4" />
            <span>Automation</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Collection Intelligence
            </span>
            <br />
            <span className="text-foreground">Powered by AI</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Transform your accounts receivable with AI that reads, understands, and acts on every customer communication. 
            Inbound emails become actionable tasks. Tasks drive automated workflows. Recovery rates improve with every interaction.
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap mb-12">
            <Button
              size="lg"
              onClick={() => navigate("/signup")}
              className="text-lg px-8 gap-2"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8"
            >
              Book a Demo
            </Button>
          </div>

          {/* Hero Visual */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card/50 backdrop-blur border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Inbox className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Inbound AI</h3>
                <p className="text-sm text-muted-foreground">Reads and understands every customer response</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <ListTodo className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Smart Tasks</h3>
                <p className="text-sm text-muted-foreground">Auto-creates tasks from customer messages</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Automation</h3>
                <p className="text-sm text-muted-foreground">Workflows that run 24/7 automatically</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Inbound AI Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Brain className="h-3 w-3" />
                Inbound AI
              </div>
              <h2 className="text-4xl font-bold mb-6">
                AI That Reads and Understands Customer Responses
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Every inbound email is analyzed by our AI to extract intent, sentiment, and actionable items. 
                No more manual reading through hundreds of customer responses—our Collection Intelligence does it for you.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Sentiment Analysis</span>
                    <p className="text-sm text-muted-foreground">Detects customer mood and urgency level</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Intent Recognition</span>
                    <p className="text-sm text-muted-foreground">Identifies payment promises, disputes, and requests</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Auto-Summary</span>
                    <p className="text-sm text-muted-foreground">Creates concise summaries for quick review</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-card p-8 rounded-2xl border shadow-lg">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Inbound Email Analysis</p>
                  <p className="text-xs text-muted-foreground">Processed in real-time</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">From: john@acmecorp.com</p>
                  <p className="text-sm italic">"Hi, we received your invoice but there's a discrepancy. Can you send the W9 and correct PO number?"</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sentiment:</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Neutral
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Intent:</span>
                    <span className="font-medium">Document Request</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Actions Detected:</span>
                    <span className="font-medium text-primary">2 tasks</span>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    AI-Generated Summary:
                  </p>
                  <p className="text-sm">Customer requests W9 form and PO number correction before payment processing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Task Creation Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-card p-8 rounded-2xl border shadow-lg">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <ListTodo className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Auto-Generated Tasks</p>
                  <p className="text-xs text-muted-foreground">From inbound email analysis</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="bg-red-100 p-1.5 rounded">
                    <Target className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Send W9 Form</p>
                    <p className="text-xs text-muted-foreground">High Priority • Acme Corp</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">Auto-created</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="bg-yellow-100 p-1.5 rounded">
                    <Target className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Correct PO Number</p>
                    <p className="text-xs text-muted-foreground">Medium Priority • Invoice #1234</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">Auto-created</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="bg-blue-100 p-1.5 rounded">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Follow-up on Payment Plan</p>
                    <p className="text-xs text-muted-foreground">Medium Priority • Beta Inc</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">Auto-created</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tasks created today:</span>
                <span className="text-2xl font-bold text-primary">12</span>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Brain className="h-3 w-3" />
                Smart Task Creation
              </div>
              <h2 className="text-4xl font-bold mb-6">
                Inbound Messages Become Actionable Tasks
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Our AI automatically extracts actionable items from every customer response and creates tasks 
                with the right priority, assignee, and context—so nothing falls through the cracks.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">W9 & Document Requests</span>
                    <p className="text-sm text-muted-foreground">Auto-detected and prioritized</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Payment Plan Requests</span>
                    <p className="text-sm text-muted-foreground">Flagged for immediate attention</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Dispute Resolution</span>
                    <p className="text-sm text-muted-foreground">Routed to the right team member</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Invoice Copy Requests</span>
                    <p className="text-sm text-muted-foreground">Quick-action tasks with templates</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Automation Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Brain className="h-3 w-3" />
              <Zap className="h-3 w-3" />
              Intelligent Automation
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Automation That Runs 24/7
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Set up workflows once, and let Collection Intelligence handle the rest. 
              From initial reminder to final escalation—automated, personalized, and always on brand.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card border-primary/20">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Clock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Scheduled Outreach</h3>
                <p className="text-muted-foreground mb-4">
                  AI agents automatically send reminders at optimal times based on customer behavior patterns and timezone.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Time-zone aware scheduling</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Optimal send-time prediction</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-primary/20">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Draft Generation</h3>
                <p className="text-muted-foreground mb-4">
                  Personalized collection messages generated automatically based on invoice age, customer history, and sentiment.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Context-aware messaging</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Human approval workflow</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-primary/20">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Adaptive Escalation</h3>
                <p className="text-muted-foreground mb-4">
                  Workflows automatically escalate based on aging buckets, response patterns, and risk scores.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Risk-based prioritization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Tone progression control</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Collection Intelligence Showcase */}
      <CollectionIntelligenceShowcase />

      {/* AI Intelligence Report Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Brain className="h-3 w-3" />
                AI Intelligence Reports
              </div>
              <h2 className="text-4xl font-bold mb-6">
                Deep-Dive AI Analysis for Every Account
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Beyond the scorecard, our AI generates comprehensive intelligence reports with executive summaries, 
                key insights, and actionable recommendations tailored to each account's unique situation.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Executive Summary</span>
                    <p className="text-sm text-muted-foreground">AI-generated overview of account health and collection status</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Key Insights</span>
                    <p className="text-sm text-muted-foreground">Pattern recognition from payment history and communications</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1 rounded-full mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Strategic Recommendations</span>
                    <p className="text-sm text-muted-foreground">Personalized action items to optimize recovery</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-card p-6 rounded-2xl border shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">AI Intelligence Report</p>
                  <p className="text-xs text-muted-foreground">Sterling Industries</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-medium text-red-500">Critical</span>
                </div>
              </div>
              
              {/* Executive Summary */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Executive Summary
                </p>
                <p className="text-sm">
                  Account shows significant collection risk with $89,500 past due and declining payment trend. 
                  Low response rate (28%) indicates potential cash flow issues or disengagement.
                </p>
              </div>

              {/* Key Insights */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Key Insights
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <Activity className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>Payment velocity slowed 40% over last 90 days</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Activity className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>6 of 8 open invoices are past due date</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Activity className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>Communication sentiment trending toward delay tactics</span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Recommendations
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-primary/5 rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Escalate to senior collections team</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-primary/5 rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Propose structured payment plan</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-primary/5 rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Increase touchpoint frequency to daily</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              How Collection Intelligence Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A continuous loop of intelligence that improves with every interaction
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-bold mb-2">Inbound Capture</h3>
              <p className="text-sm text-muted-foreground">
                Customer emails are automatically captured and analyzed by AI
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-bold mb-2">Task Extraction</h3>
              <p className="text-sm text-muted-foreground">
                AI extracts actionable items and creates prioritized tasks
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-bold mb-2">Workflow Triggers</h3>
              <p className="text-sm text-muted-foreground">
                Tasks trigger automated workflows and AI-generated responses
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-bold mb-2">Learning Loop</h3>
              <p className="text-sm text-muted-foreground">
                AI learns from outcomes to improve future interactions
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence That Compounds */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto max-w-6xl">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
            <CardContent className="p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                    <Brain className="h-3 w-3" />
                    Compounding Intelligence
                  </div>
                  <h2 className="text-4xl font-bold mb-6">
                    Intelligence That Gets Smarter Every Day
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    Every email analyzed, every task resolved, every payment received—our AI learns from it all. 
                    The more you use Collection Intelligence, the more effective it becomes at recovering your receivables.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Account intelligence: payment patterns, risk factors, collection history</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Communication intelligence: sentiment, response patterns, engagement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Task intelligence: resolution effectiveness, team performance</span>
                    </li>
                  </ul>
                </div>
                <div className="text-center">
                  <div className="inline-block p-8 bg-card rounded-3xl border shadow-xl">
                    <Brain className="w-24 h-24 text-primary mx-auto mb-6" />
                    <p className="text-2xl font-bold mb-2">Collection Intelligence</p>
                    <p className="text-sm text-muted-foreground mb-4">Platform</p>
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-medium">Powered by AI</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need for Intelligent Collections
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-card">
              <CardContent className="p-6">
                <Inbox className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Inbound Email Processing</h3>
                <p className="text-sm text-muted-foreground">Real-time analysis of all customer responses with AI summarization</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6">
                <ListTodo className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Automated Task Creation</h3>
                <p className="text-sm text-muted-foreground">AI extracts actionable items and creates prioritized tasks automatically</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6">
                <Bot className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Six AI Agents</h3>
                <p className="text-sm text-muted-foreground">Specialized agents for each stage of the collection lifecycle</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6">
                <BarChart3 className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Risk Scoring</h3>
                <p className="text-sm text-muted-foreground">AI-powered payment scores and risk tier classification</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6">
                <Users className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Team Collaboration</h3>
                <p className="text-sm text-muted-foreground">Task assignment, notifications, and team-wide visibility</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6">
                <Shield className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-bold mb-2">Human-in-the-Loop</h3>
                <p className="text-sm text-muted-foreground">Review and approve all AI-generated messages before sending</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <Brain className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-4xl font-bold mb-4">
            Experience Collection Intelligence Today
          </h2>
          <p className="text-lg mb-4 opacity-90">
            AI that reads, understands, and acts on every customer communication.
          </p>
          <p className="text-md mb-8 opacity-80">
            "Collection intelligence that improves with every interaction."
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/signup")}
              className="text-lg px-8 gap-2"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default CollectionIntelligence;
