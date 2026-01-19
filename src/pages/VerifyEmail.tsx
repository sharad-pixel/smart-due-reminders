import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { RecouplyLogo } from '@/components/RecouplyLogo';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verifyToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-email-token', {
          body: { token }
        });

        if (error || data?.error) {
          setStatus('error');
          setErrorMessage(data?.error || error?.message || 'Verification failed');
          return;
        }

        setStatus('success');
        toast.success('Email verified successfully!');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setErrorMessage('An unexpected error occurred');
      }
    };

    verifyToken();
  }, [token, navigate]);

  const handleResendVerification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please log in first to resend verification email');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { email: user.email, userId: user.id, resend: true }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to resend verification email');
        return;
      }

      toast.success('Verification email sent! Please check your inbox.');
    } catch (err) {
      console.error('Resend error:', err);
      toast.error('Failed to resend verification email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <RecouplyLogo size="lg" />
          </div>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your email address...'}
            {status === 'success' && 'Your email has been verified!'}
            {status === 'error' && 'Verification failed'}
            {status === 'no-token' && 'Check your email for the verification link'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-muted-foreground">Please wait while we verify your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium">Your email has been verified successfully!</p>
                <p className="text-muted-foreground text-sm">Redirecting you to login...</p>
              </div>
              <Button onClick={() => navigate('/login')} className="mt-4">
                Go to Login
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium">Verification Failed</p>
                <p className="text-muted-foreground text-sm">{errorMessage}</p>
              </div>
              <div className="flex flex-col gap-2 mt-4 w-full">
                <Button onClick={handleResendVerification} variant="default">
                  Resend Verification Email
                </Button>
                <Button onClick={() => navigate('/login')} variant="outline">
                  Back to Login
                </Button>
              </div>
            </div>
          )}

          {status === 'no-token' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium">Check Your Email</p>
                <p className="text-muted-foreground text-sm">
                  We've sent a verification link to your email address. 
                  Please click the link in the email to verify your account.
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-4 w-full">
                <Button onClick={handleResendVerification} variant="default">
                  Resend Verification Email
                </Button>
                <Button onClick={() => navigate('/login')} variant="outline">
                  Back to Login
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
