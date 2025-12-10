import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RichTextEditor } from "./RichTextEditor";
import { 
  Palette, 
  Type, 
  Image, 
  Layout, 
  Settings2, 
  Eye,
  Edit3,
  Undo2,
  Save,
  RefreshCw,
  AlignLeft,
  AlignCenter,
  Link,
  Square,
  Maximize2,
} from "lucide-react";

interface EditableEmailPreviewFrameProps {
  subject: string;
  bodyHtml: string;
  logoUrl?: string;
  businessName?: string;
  primaryColor?: string;
  arPageLink?: string;
  footerText?: string;
  onSave?: (data: EmailLayoutData) => void;
  readOnly?: boolean;
}

export interface EmailLayoutData {
  subject: string;
  bodyHtml: string;
  logoUrl: string;
  businessName: string;
  primaryColor: string;
  arPageLink: string;
  footerText: string;
  showLogo: boolean;
  showArPageLink: boolean;
  showFooterBranding: boolean;
  headerAlignment: "left" | "center";
  ctaButtonText: string;
  ctaButtonLink: string;
  showCtaButton: boolean;
}

const defaultLayoutData: EmailLayoutData = {
  subject: "",
  bodyHtml: "",
  logoUrl: "",
  businessName: "Recouply.ai",
  primaryColor: "#1e3a5f",
  arPageLink: "",
  footerText: "",
  showLogo: true,
  showArPageLink: true,
  showFooterBranding: true,
  headerAlignment: "center",
  ctaButtonText: "View Details",
  ctaButtonLink: "#",
  showCtaButton: false,
};

const colorPresets = [
  { name: "Navy", color: "#1e3a5f" },
  { name: "Teal", color: "#0d9488" },
  { name: "Purple", color: "#7c3aed" },
  { name: "Blue", color: "#2563eb" },
  { name: "Green", color: "#16a34a" },
  { name: "Red", color: "#dc2626" },
  { name: "Orange", color: "#ea580c" },
  { name: "Pink", color: "#db2777" },
];

export function EditableEmailPreviewFrame({
  subject,
  bodyHtml,
  logoUrl = "",
  businessName = "Recouply.ai",
  primaryColor = "#1e3a5f",
  arPageLink = "",
  footerText = "",
  onSave,
  readOnly = false,
}: EditableEmailPreviewFrameProps) {
  const [layoutData, setLayoutData] = useState<EmailLayoutData>({
    ...defaultLayoutData,
    subject,
    bodyHtml,
    logoUrl,
    businessName,
    primaryColor,
    arPageLink,
    footerText,
  });

  const [activePanel, setActivePanel] = useState<"preview" | "edit">("preview");
  const [editSection, setEditSection] = useState<"content" | "style" | "layout" | "settings">("content");

  const updateLayout = useCallback((updates: Partial<EmailLayoutData>) => {
    setLayoutData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReset = () => {
    setLayoutData({
      ...defaultLayoutData,
      subject,
      bodyHtml,
      logoUrl,
      businessName,
      primaryColor,
      arPageLink,
      footerText,
    });
  };

  const handleSave = () => {
    onSave?.(layoutData);
  };

  const fullEmailHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: ${layoutData.primaryColor};
      padding: 24px;
      text-align: ${layoutData.headerAlignment};
    }
    .email-header img {
      max-width: 140px;
      max-height: 50px;
    }
    .email-header h2 {
      color: #ffffff;
      margin: 12px 0 0 0;
      font-size: 18px;
    }
    .email-body {
      padding: 32px 24px;
    }
    .email-body h1 {
      color: ${layoutData.primaryColor};
      font-size: 24px;
      margin-top: 0;
    }
    .email-body h2 {
      color: ${layoutData.primaryColor};
      font-size: 20px;
    }
    .email-body h3 {
      color: ${layoutData.primaryColor};
      font-size: 16px;
    }
    .email-body a {
      color: ${layoutData.primaryColor};
    }
    .email-body ul, .email-body ol {
      padding-left: 24px;
    }
    .email-body li {
      margin-bottom: 8px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${layoutData.primaryColor};
      color: #ffffff !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-logo {
      max-width: 100px;
      margin-bottom: 12px;
    }
    .footer-text {
      color: #6c757d;
      font-size: 12px;
      margin: 8px 0;
    }
    .ar-page-link {
      display: inline-block;
      background-color: ${layoutData.primaryColor};
      color: #ffffff !important;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 4px;
      font-size: 13px;
      margin: 12px 0;
    }
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${layoutData.showLogo && layoutData.logoUrl ? `<img src="${layoutData.logoUrl}" alt="${layoutData.businessName}" />` : `<h2>${layoutData.businessName}</h2>`}
    </div>
    <div class="email-body">
      ${layoutData.bodyHtml}
      ${layoutData.showCtaButton ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${layoutData.ctaButtonLink}" class="cta-button">${layoutData.ctaButtonText}</a>
        </div>
      ` : ""}
    </div>
    <div class="email-footer">
      ${layoutData.showLogo && layoutData.logoUrl ? `<img src="${layoutData.logoUrl}" alt="${layoutData.businessName}" class="footer-logo" />` : ""}
      ${layoutData.showFooterBranding ? `<p class="footer-text"><strong>${layoutData.businessName}</strong></p>` : ""}
      ${layoutData.showArPageLink && layoutData.arPageLink ? `
        <a href="${layoutData.arPageLink}" class="ar-page-link">Visit Our AR Information Page</a>
      ` : ""}
      ${layoutData.footerText ? `<p class="footer-text">${layoutData.footerText}</p>` : ""}
      <div class="divider"></div>
      ${layoutData.showFooterBranding ? `
        <p class="footer-text">
          This email was sent by ${layoutData.businessName} via Recouply.ai<br>
          Collection Intelligence Platform
        </p>
        <p class="footer-text" style="color: #999;">
          © ${new Date().getFullYear()} RecouplyAI Inc. All rights reserved.
        </p>
      ` : ""}
    </div>
  </div>
</body>
</html>
    `;
  }, [layoutData]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-muted/50 border-b p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={activePanel === "preview" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePanel("preview")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button
              variant={activePanel === "edit" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePanel("edit")}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Edit Layout
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Undo2 className="h-4 w-4 mr-1" />
              Reset
            </Button>
            {onSave && (
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Apply Changes
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Side Panel for Editing */}
        {activePanel === "edit" && !readOnly && (
          <div className="w-80 border-r bg-muted/30 p-4 max-h-[700px] overflow-y-auto">
            <Tabs value={editSection} onValueChange={(v) => setEditSection(v as typeof editSection)}>
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="content" className="text-xs px-2">
                  <Type className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="style" className="text-xs px-2">
                  <Palette className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="layout" className="text-xs px-2">
                  <Layout className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs px-2">
                  <Settings2 className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Subject Line</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Input
                      value={layoutData.subject}
                      onChange={(e) => updateLayout({ subject: e.target.value })}
                      placeholder="Email subject..."
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Email Body</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <RichTextEditor
                      content={layoutData.bodyHtml}
                      onChange={(html) => updateLayout({ bodyHtml: html })}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      CTA Button
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show CTA Button</Label>
                      <Switch
                        checked={layoutData.showCtaButton}
                        onCheckedChange={(checked) => updateLayout({ showCtaButton: checked })}
                      />
                    </div>
                    {layoutData.showCtaButton && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Button Text</Label>
                          <Input
                            value={layoutData.ctaButtonText}
                            onChange={(e) => updateLayout({ ctaButtonText: e.target.value })}
                            placeholder="View Details"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Button Link</Label>
                          <Input
                            value={layoutData.ctaButtonLink}
                            onChange={(e) => updateLayout({ ctaButtonLink: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="style" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Brand Color</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.color}
                          className={`w-full h-8 rounded-md border-2 transition-all ${
                            layoutData.primaryColor === preset.color
                              ? "border-foreground scale-105"
                              : "border-transparent hover:border-muted-foreground"
                          }`}
                          style={{ backgroundColor: preset.color }}
                          onClick={() => updateLayout({ primaryColor: preset.color })}
                          title={preset.name}
                        />
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Custom Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={layoutData.primaryColor}
                          onChange={(e) => updateLayout({ primaryColor: e.target.value })}
                          className="w-12 h-9 p-1 cursor-pointer"
                        />
                        <Input
                          value={layoutData.primaryColor}
                          onChange={(e) => updateLayout({ primaryColor: e.target.value })}
                          placeholder="#1e3a5f"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Logo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show Logo</Label>
                      <Switch
                        checked={layoutData.showLogo}
                        onCheckedChange={(checked) => updateLayout({ showLogo: checked })}
                      />
                    </div>
                    {layoutData.showLogo && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Logo URL</Label>
                        <Input
                          value={layoutData.logoUrl}
                          onChange={(e) => updateLayout({ logoUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="layout" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Header</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Business Name</Label>
                      <Input
                        value={layoutData.businessName}
                        onChange={(e) => updateLayout({ businessName: e.target.value })}
                        placeholder="Your Company"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Alignment</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={layoutData.headerAlignment === "left" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateLayout({ headerAlignment: "left" })}
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={layoutData.headerAlignment === "center" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateLayout({ headerAlignment: "center" })}
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Footer</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show Branding</Label>
                      <Switch
                        checked={layoutData.showFooterBranding}
                        onCheckedChange={(checked) => updateLayout({ showFooterBranding: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show AR Page Link</Label>
                      <Switch
                        checked={layoutData.showArPageLink}
                        onCheckedChange={(checked) => updateLayout({ showArPageLink: checked })}
                      />
                    </div>
                    {layoutData.showArPageLink && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">AR Page Link</Label>
                        <Input
                          value={layoutData.arPageLink}
                          onChange={(e) => updateLayout({ arPageLink: e.target.value })}
                          placeholder="/ar/your-token"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Custom Footer Text</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Textarea
                      value={layoutData.footerText}
                      onChange={(e) => updateLayout({ footerText: e.target.value })}
                      placeholder="Add custom footer text, disclaimers, etc."
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => updateLayout({ 
                        showLogo: true, 
                        showFooterBranding: true, 
                        showArPageLink: true 
                      })}
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Show All Elements
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => updateLayout({ 
                        showLogo: false, 
                        showFooterBranding: false, 
                        showArPageLink: false 
                      })}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Minimal Layout
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Preview Panel */}
        <div className="flex-1">
          {/* Email client header simulation */}
          <div className="bg-muted/50 border-b p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium w-16">From:</span>
              <span className="text-foreground">{layoutData.businessName} &lt;notifications@send.inbound.services.recouply.ai&gt;</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium w-16">To:</span>
              <span className="text-foreground">recipient@example.com</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium w-16">Subject:</span>
              {activePanel === "edit" && !readOnly ? (
                <Input
                  value={layoutData.subject}
                  onChange={(e) => updateLayout({ subject: e.target.value })}
                  className="h-7 text-sm font-medium"
                />
              ) : (
                <span className="text-foreground font-medium">{layoutData.subject}</span>
              )}
            </div>
          </div>
          
          {/* Email content iframe */}
          <iframe
            srcDoc={fullEmailHtml}
            className="w-full h-[600px] border-0"
            title="Email Preview"
          />
        </div>
      </div>
    </div>
  );
}
