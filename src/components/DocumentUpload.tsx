import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X } from "lucide-react";
import { useUploadDocument } from "@/hooks/useDocuments";

interface DocumentUploadProps {
  organizationId?: string;
  debtorId?: string;
  onUploadComplete?: () => void;
}

const DOCUMENT_CATEGORIES = [
  { value: "ACH", label: "ACH Form" },
  { value: "WIRE", label: "Wire Instructions" },
  { value: "W9", label: "W-9 Tax Form" },
  { value: "EIN", label: "EIN Letter" },
  { value: "PROOF_OF_BUSINESS", label: "Proof of Business" },
  { value: "CONTRACT", label: "Contract / Agreement" },
  { value: "BANKING_INFO", label: "Banking Information" },
  { value: "TAX_DOCUMENT", label: "Tax Document" },
  { value: "OTHER", label: "Other Document" },
];

export default function DocumentUpload({ organizationId, debtorId, onUploadComplete }: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadDocument();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !category) return;

    await uploadMutation.mutateAsync({
      file: selectedFile,
      category,
      organizationId,
      debtorId,
      notes,
    });

    setSelectedFile(null);
    setCategory("");
    setNotes("");
    onUploadComplete?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div className="text-left flex-1">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div>
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium mb-1">
                Drop your document here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, Excel, Images (Max 50MB)
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Document Category <span className="text-destructive">*</span>
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Notes (Optional)
          </label>
          <Textarea
            placeholder="Add any additional notes about this document..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !category || uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
        </Button>
      </CardContent>
    </Card>
  );
}
