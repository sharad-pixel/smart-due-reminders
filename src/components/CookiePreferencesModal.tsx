import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shield, BarChart3, Target, Cog } from 'lucide-react';
import type { CookiePreferences } from '@/hooks/useCookieConsent';

interface CookiePreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPreferences: CookiePreferences | null;
  onSave: (preferences: Omit<CookiePreferences, 'necessary' | 'timestamp'>) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const cookieCategories = [
  {
    id: 'necessary' as const,
    name: 'Strictly Necessary',
    description: 'These cookies are essential for the website to function properly. They enable basic functions like page navigation, secure areas access, and session management. The website cannot function properly without these cookies.',
    icon: Shield,
    required: true,
  },
  {
    id: 'functional' as const,
    name: 'Functional',
    description: 'These cookies enable enhanced functionality and personalization, such as remembering your preferences, language settings, and login details. If you do not allow these cookies, some or all of these services may not function properly.',
    icon: Cog,
    required: false,
  },
  {
    id: 'analytics' as const,
    name: 'Analytics',
    description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our website and services.',
    icon: BarChart3,
    required: false,
  },
  {
    id: 'marketing' as const,
    name: 'Marketing',
    description: 'These cookies are used to track visitors across websites to display relevant advertisements. They are also used to limit the number of times you see an ad and help measure the effectiveness of advertising campaigns.',
    icon: Target,
    required: false,
  },
];

export function CookiePreferencesModal({
  open,
  onOpenChange,
  currentPreferences,
  onSave,
  onAcceptAll,
  onRejectAll,
}: CookiePreferencesModalProps) {
  const [preferences, setPreferences] = useState({
    functional: currentPreferences?.functional ?? false,
    analytics: currentPreferences?.analytics ?? false,
    marketing: currentPreferences?.marketing ?? false,
  });

  const handleToggle = (category: 'functional' | 'analytics' | 'marketing') => {
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSave = () => {
    onSave(preferences);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
          <DialogDescription>
            Manage your cookie preferences. You can enable or disable different types of cookies below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {cookieCategories.map((category, index) => {
            const Icon = category.icon;
            const isEnabled = category.required || preferences[category.id as keyof typeof preferences];
            
            return (
              <div key={category.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={category.id} className="font-medium">
                          {category.name}
                        </Label>
                        {category.required && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={category.id}
                    checked={isEnabled}
                    onCheckedChange={() => !category.required && handleToggle(category.id as 'functional' | 'analytics' | 'marketing')}
                    disabled={category.required}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onRejectAll} className="w-full sm:w-auto">
            Reject All
          </Button>
          <Button variant="outline" onClick={onAcceptAll} className="w-full sm:w-auto">
            Accept All
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
