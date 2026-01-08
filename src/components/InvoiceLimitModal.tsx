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
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TRIAL_CONFIG } from '@/lib/subscriptionConfig';
import { toast } from 'sonner';

interface InvoiceLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
}

export function InvoiceLimitModal({ open, onOpenChange, onContinue }: InvoiceLimitModalProps) {
  const [usage, setUsage] = useState<{ includedUsed: number; invoiceAllowance: number | string } | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

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
          includedUsed: data.includedUsed ?? data.included_invoices_used ?? 0,
          invoiceAllowance: data.invoiceAllowance ?? data.included_allowance ?? TRIAL_CONFIG.invoiceLimit,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const handleStartCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planId: 'starter',
          billingInterval: 'month'
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setIsCheckingOut(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Trial Invoice Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've reached the {TRIAL_CONFIG.invoiceLimit}-invoice trial limit. Subscribe to continue creating invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {usage && (
            <div className="bg-muted p-4 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <span>Trial Invoices Used</span>
                <span className="font-medium">{usage.includedUsed} / {usage.invoiceAllowance}</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
              <h4 className="font-semibold mb-2">Starter Plan - $199/month</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Up to 100 invoices/month</li>
                <li>• 6 AI collection agents</li>
                <li>• Email & SMS outreach</li>
                <li>• Team collaboration</li>
              </ul>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Subscribe now to unlock full access and continue managing your invoices.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleStartCheckout} 
            disabled={isCheckingOut}
            className="w-full"
          >
            {isCheckingOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up checkout...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Subscribe to Starter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
