import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AddressAutocompleteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'google_places' | 'mapbox'>('google_places');
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('address_autocomplete_enabled, address_autocomplete_provider, address_autocomplete_api_key')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setEnabled(profile.address_autocomplete_enabled || false);
        setProvider((profile.address_autocomplete_provider as 'google_places' | 'mapbox') || 'google_places');
        setApiKey(profile.address_autocomplete_api_key || '');
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          address_autocomplete_enabled: enabled,
          address_autocomplete_provider: provider,
          address_autocomplete_api_key: apiKey || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Address autocomplete settings have been updated.",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-3xl py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Address Autocomplete
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure smart address autofill for faster data entry across Recouply
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Address Autocomplete Settings</CardTitle>
            <CardDescription>
              Enable address autocomplete to quickly search and fill structured addresses for debtors, invoices, and your workspace profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable Address Autocomplete</Label>
                <p className="text-sm text-muted-foreground">
                  Turn on smart address autofill across the application
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            {enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={provider} onValueChange={(val) => setProvider(val as 'google_places' | 'mapbox')}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_places">Google Places</SelectItem>
                      <SelectItem value="mapbox">Mapbox</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose which geocoding service to use for address lookups
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    {provider === 'google_places' ? 'Google API Key' : 'Mapbox Access Token'}
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'google_places' ? 'Enter your Google API key' : 'Enter your Mapbox access token'}
                  />
                  <p className="text-sm text-muted-foreground">
                    {provider === 'google_places'
                      ? 'Get your API key from Google Cloud Console (enable Places API and Geocoding API)'
                      : 'Get your access token from your Mapbox account dashboard'}
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>How it works:</strong> When you start typing an address, we'll show real-time suggestions. 
                    Select one to automatically fill all address fields. You can still edit any field afterwards or choose to enter addresses manually.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Where it's used:</strong> Address autocomplete is available on:
                    <ul className="list-disc list-inside mt-2 ml-2">
                      <li>Debtor creation and editing</li>
                      <li>Workspace/Organization profile</li>
                      <li>Invoice billing addresses</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving || (enabled && !apiKey)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
