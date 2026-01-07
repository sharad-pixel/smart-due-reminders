import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eye, FileText, Sparkles } from "lucide-react";

interface EmailPreviewPanelProps {
  formData: {
    business_name?: string | null;
    from_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    accent_color?: string | null;
    email_signature?: string | null;
    email_footer?: string | null;
    ar_page_enabled?: boolean | null;
    ar_page_public_token?: string | null;
    stripe_payment_link?: string | null;
    email_format?: "simple" | "enhanced" | null;
  };
  onFormatChange?: (format: "simple" | "enhanced") => void;
}

export function EmailPreviewPanel({ formData, onFormatChange }: EmailPreviewPanelProps) {
  const [emailFormat, setEmailFormat] = useState<"simple" | "enhanced">(
    formData.email_format || "enhanced"
  );
  
  // Sync with formData when it loads
  useEffect(() => {
    if (formData.email_format) {
      setEmailFormat(formData.email_format);
    }
  }, [formData.email_format]);

  const handleFormatChange = (value: string | undefined) => {
    if (value && (value === "simple" || value === "enhanced")) {
      setEmailFormat(value);
      onFormatChange?.(value);
    }
  };
  
  const businessName = formData.business_name || formData.from_name || "Your Business";
  const primaryColor = formData.primary_color || "#111827";
  const accentColor = formData.accent_color || "#6366f1";
  const arPageUrl = formData.ar_page_public_token && formData.ar_page_enabled 
    ? `${window.location.origin}/ar/${formData.ar_page_public_token}` 
    : null;

  const getEmailContent = (type: 'friendly' | 'past_due') => {
    const subject = type === 'friendly' 
      ? `Friendly Reminder: Invoice #12345 is Due`
      : `Payment Required: Invoice #12345 - 30+ Days Overdue`;
    
    const bodyHtml = type === 'friendly' ? `
      <p>Hi John,</p>
      <p>I hope this message finds you well! I wanted to reach out regarding invoice #12345 for $1,500.00, which was due on December 15, 2025.</p>
      <p>If you've already sent payment, please disregard this message. Otherwise, we'd appreciate if you could process this at your earliest convenience.</p>
      <p>Best regards,<br/>Sam</p>
    ` : `
      <p>Dear John,</p>
      <p>I'm writing regarding invoice #12345 for $1,500.00, which is now over 30 days past due.</p>
      <p>Please process payment immediately or contact us to discuss payment arrangements.</p>
      <p>Regards,<br/>James</p>
    `;

    return { subject, bodyHtml };
  };

  const renderSimplePreview = (type: 'friendly' | 'past_due') => {
    const { subject, bodyHtml } = getEmailContent(type);
    
    return (
      <div className="border rounded-lg overflow-hidden bg-slate-50 p-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[480px] mx-auto font-mono text-xs">
          {/* Simple Email Header */}
          <div className="px-4 py-3 border-b bg-slate-100">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <span className="font-semibold">From:</span>
              <span>{formData.from_name || businessName} &lt;noreply@recouply.ai&gt;</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <span className="font-semibold">To:</span>
              <span>john@example.com</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-semibold">Subject:</span>
              <span>{subject}</span>
            </div>
          </div>

          {/* Plain HTML Body */}
          <div 
            className="p-4 text-sm text-slate-700"
            style={{ fontFamily: 'Arial, sans-serif' }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {/* Simple Signature */}
          {formData.email_signature && (
            <div className="px-4 pb-4 pt-2 border-t">
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{formData.email_signature}</pre>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground text-center mt-3">
          Simple format — no branding, just plain HTML
        </p>
      </div>
    );
  };

  const renderEnhancedPreview = (type: 'friendly' | 'past_due') => {
    const { subject } = getEmailContent(type);
    
    const bodyContent = type === 'friendly' ? (
      <>
        <p style={{ margin: '0 0 16px' }}>Hi John,</p>
        <p style={{ margin: '0 0 16px' }}>
          I hope this message finds you well! I wanted to reach out regarding invoice #12345 for $1,500.00, which was due on December 15, 2025.
        </p>
        <p style={{ margin: '0 0 16px' }}>
          If you've already sent payment, please disregard this message. Otherwise, we'd appreciate if you could process this at your earliest convenience.
        </p>
        <p style={{ margin: '0' }}>Best regards,<br/>Sam</p>
      </>
    ) : (
      <>
        <p style={{ margin: '0 0 16px' }}>Dear John,</p>
        <p style={{ margin: '0 0 16px' }}>
          I'm writing regarding invoice #12345 for $1,500.00, which is now over 30 days past due.
        </p>
        <p style={{ margin: '0 0 16px' }}>
          Please process payment immediately or contact us to discuss payment arrangements.
        </p>
        <p style={{ margin: '0' }}>Regards,<br/>James</p>
      </>
    );

    return (
      <div className="border rounded-lg overflow-hidden bg-slate-100 p-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[480px] mx-auto">
          {/* Email Header */}
          <div 
            className="p-4"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${lightenColor(primaryColor, 20)} 100%)` }}
          >
            {formData.logo_url ? (
              <img 
                src={formData.logo_url} 
                alt={businessName}
                className="h-8 max-w-[140px] object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            ) : (
              <span className="text-white font-bold text-lg">{businessName}</span>
            )}
          </div>

          {/* Email Subject */}
          <div className="px-4 py-2 border-b bg-slate-50">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-medium">{subject}</p>
          </div>

          {/* Email Body */}
          <div className="p-4 text-sm text-slate-700">
            {bodyContent}
          </div>

          {/* CTA Button (if stripe payment link exists) */}
          {formData.stripe_payment_link && (
            <div className="px-4 pb-4 text-center">
              <a 
                href="#" 
                className="inline-block px-6 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: accentColor }}
                onClick={(e) => e.preventDefault()}
              >
                💳 Pay Now
              </a>
            </div>
          )}

          {/* Signature */}
          {formData.email_signature && (
            <div className="px-4 pb-4 border-t pt-4">
              <p className="text-xs text-slate-600 whitespace-pre-line">{formData.email_signature}</p>
            </div>
          )}

          {/* AR Page CTA */}
          {arPageUrl && (
            <div className="mx-4 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <p className="text-xs text-blue-800 font-medium mb-1">
                📄 {businessName} AR Portal
              </p>
              <p className="text-xs text-blue-600">
                View payment options & documents
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-slate-900 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">R</span>
              </div>
              <span className="text-white text-sm font-semibold">Recouply<span className="text-blue-400">.ai</span></span>
            </div>
            <p className="text-slate-400 text-xs">Collection Intelligence Platform</p>
            <div className="flex justify-center gap-3 mt-2 text-xs">
              <span className="text-slate-500 px-2 py-0.5 rounded bg-blue-900/30">🤖 6 AI Agents</span>
              <span className="text-slate-500 px-2 py-0.5 rounded bg-purple-900/30">⚡ 24/7 Collections</span>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground text-center mt-3">
          Enhanced format — branded template with logo & styling
        </p>
      </div>
    );
  };

  const renderPreview = (type: 'friendly' | 'past_due') => {
    return emailFormat === "simple" 
      ? renderSimplePreview(type) 
      : renderEnhancedPreview(type);
  };

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-4 w-4" />
          Email Preview
        </CardTitle>
        <CardDescription>
          Live preview of how your emails will look
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Email Format</span>
          <ToggleGroup 
            type="single" 
            value={emailFormat} 
            onValueChange={handleFormatChange}
            className="bg-muted p-1 rounded-lg"
          >
            <ToggleGroupItem 
              value="simple" 
              aria-label="Simple format"
              className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3 py-1.5 text-xs gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Simple
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="enhanced" 
              aria-label="Enhanced format"
              className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3 py-1.5 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Enhanced
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <p className="text-xs text-muted-foreground">
          This setting is saved to your account and applies to all outgoing emails.
        </p>

        {/* Email Type Tabs */}
        <Tabs defaultValue="friendly" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="friendly">Friendly Reminder</TabsTrigger>
            <TabsTrigger value="past_due">Past Due Notice</TabsTrigger>
          </TabsList>
          <TabsContent value="friendly">
            {renderPreview('friendly')}
          </TabsContent>
          <TabsContent value="past_due">
            {renderPreview('past_due')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper function to lighten a hex color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
