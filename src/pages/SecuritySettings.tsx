import Layout from "@/components/Layout";
import { MFASettings } from "@/components/MFASettings";
import { SessionManager } from "@/components/SessionManager";
import { Separator } from "@/components/ui/separator";

const SecuritySettings = () => {
  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account security and authentication preferences
          </p>
        </div>

        <Separator />

        <div className="space-y-6">
          <MFASettings />
          <SessionManager />
        </div>
      </div>
    </Layout>
  );
};

export default SecuritySettings;
