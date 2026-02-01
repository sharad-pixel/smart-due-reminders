import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, FileText, Sparkles, Maximize2 } from "lucide-react";

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
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [fullPreviewType, setFullPreviewType] = useState<'friendly' | 'past_due'>('friendly');
  
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

  const openFullPreview = (type: 'friendly' | 'past_due') => {
    setFullPreviewType(type);
    setFullPreviewOpen(true);
  };

  const renderSimplePreview = (type: 'friendly' | 'past_due', isFullPreview = false) => {
    const { subject, bodyHtml } = getEmailContent(type);
    const maxWidth = isFullPreview ? "600px" : "480px";
    
    return (
      <div className={`border rounded-lg overflow-hidden bg-slate-50 ${isFullPreview ? 'p-6' : 'p-4'}`}>
        <div className={`bg-white rounded-lg shadow-sm overflow-hidden mx-auto font-mono text-xs`} style={{ maxWidth }}>
          {/* Simple Email Header */}
          <div className="px-4 py-3 border-b bg-slate-100">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <span className="font-semibold">From:</span>
              <span>{formData.from_name || businessName} &lt;collections@yourdomain.com&gt;</span>
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
            className={`p-4 text-slate-700 ${isFullPreview ? 'text-base' : 'text-sm'}`}
            style={{ fontFamily: 'Arial, sans-serif' }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {/* Simple Signature */}
          {formData.email_signature && (
            <div className="px-4 pb-4 pt-2 border-t">
              <pre className={`text-slate-600 whitespace-pre-wrap font-sans ${isFullPreview ? 'text-sm' : 'text-xs'}`}>{formData.email_signature}</pre>
            </div>
          )}

          {/* Minimal Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t text-center">
            <p className="text-[10px] text-slate-400">
              powered by recouply.ai
            </p>
          </div>
        </div>
        
        {!isFullPreview && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Simple format — no branding, just plain HTML
          </p>
        )}
      </div>
    );
  };

  const renderEnhancedPreview = (type: 'friendly' | 'past_due', isFullPreview = false) => {
    const { subject } = getEmailContent(type);
    const maxWidth = isFullPreview ? "600px" : "480px";
    const fontSize = isFullPreview ? 'text-base' : 'text-sm';
    
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
      <div className={`border rounded-lg overflow-hidden bg-slate-100 ${isFullPreview ? 'p-6' : 'p-4'}`}>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mx-auto" style={{ maxWidth }}>
          {/* Email Header with User's Branding */}
          <div 
            className={`${isFullPreview ? 'p-6' : 'p-4'}`}
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${lightenColor(primaryColor, 20)} 100%)` }}
          >
            {formData.logo_url ? (
              <img 
                src={formData.logo_url} 
                alt={businessName}
                className={`${isFullPreview ? 'h-12' : 'h-8'} max-w-[180px] object-contain`}
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            ) : (
              <span className={`text-white font-bold ${isFullPreview ? 'text-2xl' : 'text-lg'}`}>{businessName}</span>
            )}
          </div>

          {/* Email Subject */}
          <div className="px-4 py-2 border-b bg-slate-50">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className={`font-medium ${fontSize}`}>{subject}</p>
          </div>

          {/* Email Body */}
          <div className={`${isFullPreview ? 'p-6' : 'p-4'} ${fontSize} text-slate-700`}>
            {bodyContent}
          </div>

          {/* CTA Button (if stripe payment link exists) */}
          {formData.stripe_payment_link && (
            <div className={`px-4 ${isFullPreview ? 'pb-6' : 'pb-4'} text-center`}>
              <a 
                href="#" 
                className={`inline-block ${isFullPreview ? 'px-8 py-3' : 'px-6 py-2'} rounded-lg ${fontSize} font-semibold text-white`}
                style={{ backgroundColor: accentColor }}
                onClick={(e) => e.preventDefault()}
              >
                💳 Pay Now
              </a>
            </div>
          )}

          {/* Signature */}
          {formData.email_signature && (
            <div className={`px-4 ${isFullPreview ? 'pb-6' : 'pb-4'} border-t pt-4`}>
              <p className={`text-slate-600 whitespace-pre-line ${isFullPreview ? 'text-sm' : 'text-xs'}`}>{formData.email_signature}</p>
            </div>
          )}

          {/* AR Page CTA - User's branding */}
          {arPageUrl && (
            <div className={`mx-4 mb-4 p-3 rounded-lg text-center`} style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}30` }}>
              <p className="text-xs font-medium mb-1" style={{ color: primaryColor }}>
                📄 {businessName} AR Portal
              </p>
              <p className="text-xs" style={{ color: `${primaryColor}99` }}>
                View payment options & documents
              </p>
            </div>
          )}

          {/* Footer - Minimal "powered by" only */}
          <div className={`${isFullPreview ? 'p-6' : 'p-4'} bg-slate-100 text-center border-t`}>
            {formData.email_footer && (
              <p className={`text-slate-500 mb-2 ${isFullPreview ? 'text-xs' : 'text-[10px]'}`}>{formData.email_footer}</p>
            )}
            <p className="text-[10px] text-slate-400">
              powered by recouply.ai
            </p>
          </div>
        </div>
        
        {!isFullPreview && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Enhanced format — branded template with logo & styling
          </p>
        )}
      </div>
    );
  };

  const renderPreview = (type: 'friendly' | 'past_due', isFullPreview = false) => {
    return emailFormat === "simple" 
      ? renderSimplePreview(type, isFullPreview) 
      : renderEnhancedPreview(type, isFullPreview);
  };

  return (
    <>
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
              <div className="mt-3 flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openFullPreview('friendly')}
                  className="gap-2"
                >
                  <Maximize2 className="h-4 w-4" />
                  View Full Template
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="past_due">
              {renderPreview('past_due')}
              <div className="mt-3 flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openFullPreview('past_due')}
                  className="gap-2"
                >
                  <Maximize2 className="h-4 w-4" />
                  View Full Template
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Template Preview Dialog */}
      <Dialog open={fullPreviewOpen} onOpenChange={setFullPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Full Email Template Preview
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            <Tabs value={fullPreviewType} onValueChange={(v) => setFullPreviewType(v as 'friendly' | 'past_due')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="friendly">Friendly Reminder</TabsTrigger>
                <TabsTrigger value="past_due">Past Due Notice</TabsTrigger>
              </TabsList>
              <TabsContent value="friendly">
                {renderPreview('friendly', true)}
              </TabsContent>
              <TabsContent value="past_due">
                {renderPreview('past_due', true)}
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">Template Variables</h4>
            <p className="text-xs text-muted-foreground">
              In actual emails, the following will be replaced with real data:
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• <code className="bg-background px-1 rounded">John</code> → Customer's actual name</li>
              <li>• <code className="bg-background px-1 rounded">#12345</code> → Actual invoice number</li>
              <li>• <code className="bg-background px-1 rounded">$1,500.00</code> → Actual invoice amount</li>
              <li>• <code className="bg-background px-1 rounded">December 15, 2025</code> → Actual due date</li>
              <li>• <code className="bg-background px-1 rounded">Sam/James</code> → Assigned AI persona name</li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
