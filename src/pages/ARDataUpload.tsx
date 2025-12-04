import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, DollarSign, Upload } from "lucide-react";
import { ARUploadWizard } from "@/components/ar-upload/ARUploadWizard";

type UploadType = "invoice_detail" | "payments";

const uploadTypes = [
  {
    type: "invoice_detail" as UploadType,
    title: "Invoice Aging (Detailed)",
    description: "Upload invoice-level AR aging data with customer and invoice details",
    icon: FileSpreadsheet,
    requiredFields: ["Customer Name", "Invoice Number", "Invoice Date", "Due Date", "Amount"],
    optionalFields: ["Currency", "Status", "Notes", "Product Description", "Contact Email", "Contact Name"],
  },
  {
    type: "payments" as UploadType,
    title: "Payments",
    description: "Upload payment data to automatically match against invoices",
    icon: DollarSign,
    requiredFields: ["Customer Name", "Payment Date", "Amount"],
    optionalFields: ["Currency", "Reference", "Invoice Number", "Notes"],
  },
];

const ARDataUpload = () => {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleSelectType = (type: UploadType) => {
    setSelectedType(type);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setSelectedType(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AR Data Upload</h1>
          <p className="text-muted-foreground">
            Import your accounts receivable data from Excel or CSV files
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {uploadTypes.map((uploadType) => {
            const Icon = uploadType.icon;
            return (
              <Card
                key={uploadType.type}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                onClick={() => handleSelectType(uploadType.type)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{uploadType.title}</CardTitle>
                  </div>
                  <CardDescription>{uploadType.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Required Fields:</p>
                      <div className="flex flex-wrap gap-1">
                        {uploadType.requiredFields.map((field) => (
                          <span
                            key={field}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                    {uploadType.optionalFields.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Optional:</p>
                        <div className="flex flex-wrap gap-1">
                          {uploadType.optionalFields.map((field) => (
                            <span
                              key={field}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <button className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        <Upload className="h-4 w-4" />
                        Start Upload
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedType && (
          <ARUploadWizard
            open={wizardOpen}
            onClose={handleWizardClose}
            uploadType={selectedType}
          />
        )}
      </div>
    </Layout>
  );
};

export default ARDataUpload;
