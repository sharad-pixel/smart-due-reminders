import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Mail, 
  Edit, 
  Eye, 
  Save, 
  Plus, 
  Search,
  FileText,
  Bell,
  Megaphone,
  Shield,
  DollarSign,
  Code,
  Variable
} from "lucide-react";

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  category: string;
  subject_template: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  transactional: { label: "Transactional", icon: <FileText className="h-4 w-4" />, color: "bg-blue-500" },
  notification: { label: "Notification", icon: <Bell className="h-4 w-4" />, color: "bg-amber-500" },
  collection: { label: "Collection", icon: <DollarSign className="h-4 w-4" />, color: "bg-green-500" },
  marketing: { label: "Marketing", icon: <Megaphone className="h-4 w-4" />, color: "bg-purple-500" },
  admin: { label: "Admin", icon: <Shield className="h-4 w-4" />, color: "bg-red-500" },
};

export default function AdminEmailTemplates() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("template_name", { ascending: true });
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("email_templates")
        .update({
          ...template,
          updated_by: user?.id,
        })
        .eq("id", template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template updated successfully");
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: Omit<EmailTemplate, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("email_templates")
        .insert({
          ...template,
          created_by: user?.id,
          updated_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template created successfully");
      setIsCreateOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create template: " + error.message);
    },
  });

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.template_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...Object.keys(categoryConfig)];

  return (
    <AdminLayout title="Email Templates" description="Manage platform-wide email templates and communications">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const config = categoryConfig[template.category] || categoryConfig.transactional;
              return (
                <Card key={template.id} className={`relative ${!template.is_active ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${config.color} text-white`}>
                          {config.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.template_name}</CardTitle>
                          <code className="text-xs text-muted-foreground">{template.template_key}</code>
                        </div>
                      </div>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description || "No description"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(template.variables as string[])?.slice(0, 3).map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                      {(template.variables as string[])?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(template.variables as string[]).length - 3} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <TemplateEditDialog
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(template) => updateMutation.mutate(template)}
          isSaving={updateMutation.isPending}
        />

        {/* Preview Dialog */}
        <TemplatePreviewDialog
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />

        {/* Create Dialog */}
        <TemplateCreateDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={(template) => createMutation.mutate(template)}
          isCreating={createMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

// Edit Dialog Component
function TemplateEditDialog({
  template,
  onClose,
  onSave,
  isSaving,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSave: (template: Partial<EmailTemplate> & { id: string }) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({});
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    if (template) {
      setFormData(template);
    }
  }, [template]);

  if (!template) return null;

  const handleSave = () => {
    onSave({ ...formData, id: template.id });
  };

  return (
    <Dialog open={!!template} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Edit Template: {template.template_name}
          </DialogTitle>
          <DialogDescription>
            Modify the email template content and settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="html">HTML Editor</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formData.template_name || ""}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={formData.subject_template || ""}
                onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use variables like {"{{user_name}}"} for personalization
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="html" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HTML Body</Label>
                <Badge variant="outline" className="gap-1">
                  <Code className="h-3 w-3" />
                  HTML
                </Badge>
              </div>
              <Textarea
                value={formData.body_html || ""}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Plain Text Body (Fallback)</Label>
              <Textarea
                value={formData.body_text || ""}
                onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Enable or disable this template</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Variable className="h-4 w-4" />
                <Label>Available Variables</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {(formData.variables as string[])?.map((v) => (
                  <Badge key={v} variant="secondary">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Preview Dialog Component
function TemplatePreviewDialog({
  template,
  onClose,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;

  // Replace variables with sample data for preview
  const sampleData: Record<string, string> = {
    user_name: "John Smith",
    user_email: "john@example.com",
    contact_name: "Jane Doe",
    company_name: "Acme Corp",
    invoice_number: "INV-2024-001",
    amount: "1,500.00",
    due_date: "December 15, 2024",
    days_past_due: "15",
    task_summary: "Follow up on payment",
    account_name: "Acme Corporation",
    priority: "High",
    assignee_name: "Sarah Johnson",
    task_link: "#",
    dashboard_link: "#",
    invite_link: "#",
    reset_link: "#",
    feature_link: "#",
    cta_link: "#",
    cta_text: "Learn More",
    role: "Team Member",
    expires_at: "December 20, 2024",
    digest_date: "December 10, 2024",
    health_score: "78",
    health_label: "Good",
    total_ar: "125,000",
    ar_current: "45,000",
    ar_1_30: "35,000",
    ar_31_60: "25,000",
    ar_61_90: "15,000",
    ar_90_plus: "5,000",
    open_tasks: "12",
    overdue_tasks: "3",
    inviter_name: "Admin User",
    payment_date: "December 8, 2024",
    payment_reference: "PAY-2024-123",
    month: "December",
    year: "2024",
    feature_name: "AI Outreach",
    feature_description: "Generate personalized collection messages with AI.",
    update_content: "<ul><li>New AI personas</li><li>Improved dashboard</li></ul>",
    alert_type: "New Signup",
    alert_subject: "New user registered",
    alert_details: "<p>User john@example.com signed up.</p>",
    timestamp: new Date().toISOString(),
  };

  const replaceVariables = (text: string) => {
    let result = text;
    Object.entries(sampleData).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    return result;
  };

  const previewSubject = replaceVariables(template.subject_template);
  const previewBody = replaceVariables(template.body_html);

  return (
    <Dialog open={!!template} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {template.template_name}
          </DialogTitle>
          <DialogDescription>
            Preview how this email will appear to recipients
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Subject:</p>
            <p className="font-medium">{previewSubject}</p>
          </div>

          <div className="border rounded-lg p-6 bg-white">
            <div
              dangerouslySetInnerHTML={{ __html: previewBody }}
              className="prose prose-sm max-w-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Dialog Component
function TemplateCreateDialog({
  open,
  onClose,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (template: Omit<EmailTemplate, "id" | "created_at" | "updated_at">) => void;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    template_key: "",
    template_name: "",
    category: "transactional",
    subject_template: "",
    body_html: "",
    body_text: "",
    variables: [] as string[],
    is_active: true,
    description: "",
  });

  const handleCreate = () => {
    if (!formData.template_key || !formData.template_name || !formData.subject_template || !formData.body_html) {
      toast.error("Please fill in all required fields");
      return;
    }
    onCreate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Template
          </DialogTitle>
          <DialogDescription>
            Create a new email template for platform communications
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Key *</Label>
              <Input
                placeholder="e.g., payment_reminder"
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value.toLowerCase().replace(/\s/g, "_") })}
              />
            </div>
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Payment Reminder"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject Line *</Label>
            <Input
              placeholder="e.g., Reminder: Invoice {{invoice_number}}"
              value={formData.subject_template}
              onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>HTML Body *</Label>
            <Textarea
              placeholder="<p>Hello {{user_name}},</p>"
              value={formData.body_html}
              onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Brief description of when this template is used"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Creating..." : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
