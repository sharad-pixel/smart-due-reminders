import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
}

export function InvoiceLimitModal({ open, onOpenChange, onContinue }: InvoiceLimitModalProps) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<{ includedUsed: number; invoiceAllowance: number | string; overageRate: number } | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsage();
    }
  }, [open]);

  const fetchUsage = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-monthly-usage');
      if (data) {
        setUsage({
          includedUsed: data.includedUsed,
          invoiceAllowance: data.invoiceAllowance,
          overageRate: data.overageRate,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/upgrade');
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Invoice Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've used all your included invoices for this billing period.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {usage && (
            <div className="bg-muted p-4 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <span>Invoices Used</span>
                <span className="font-medium">{usage.includedUsed} / {usage.invoiceAllowance}</span>
              </div>
              <div className="flex justify-between">
                <span>Overage Rate</span>
                <span className="font-medium">${usage.overageRate.toFixed(2)} per invoice</span>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            You can continue creating invoices, but each additional invoice will be billed at the overage rate at the end of your billing cycle.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleContinue}>
            Continue with Overage
          </Button>
          <Button onClick={handleUpgrade}>
            Upgrade Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
