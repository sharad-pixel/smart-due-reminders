import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, UserPlus, Download, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

interface WhitelistEntry {
  id: string;
  email: string;
  invitee_name: string | null;
  inviter_name: string | null;
  notes: string | null;
  invited_at: string;
  used_at: string | null;
}

const AdminWaitlist = () => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: waitlistData }, { data: whitelistData }] = await Promise.all([
        supabase.from("waitlist_signups").select("*").order("created_at", { ascending: false }),
        supabase.from("early_access_whitelist").select("*").order("invited_at", { ascending: false }),
      ]);

      setWaitlist(waitlistData || []);
      setWhitelist(whitelistData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToWhitelist = async (email: string) => {
    try {
      const { error } = await supabase.from("early_access_whitelist").insert({
        email: email.toLowerCase(),
        inviter_name: "Admin",
        notes: "Added from waitlist",
      });

      if (error) throw error;

      // Send alert to support@recouply.ai
      await supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "admin_invite",
          email: email.toLowerCase(),
          inviterName: "Admin",
          notes: "Added from waitlist",
        },
      });

      toast({ title: "Added to whitelist", description: `${email} - alert sent to support` });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const { error } = await supabase.from("early_access_whitelist").insert({
        email: inviteEmail.toLowerCase(),
        invitee_name: inviteName || null,
        inviter_name: "Admin",
        notes: inviteNotes || null,
      });

      if (error) throw error;

      // Send alert to support@recouply.ai
      await supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "admin_invite",
          email: inviteEmail.toLowerCase(),
          name: inviteName || null,
          inviterName: "Admin",
          notes: inviteNotes || null,
        },
      });

      toast({ title: "Invite sent", description: `${inviteEmail} added to whitelist and alert sent to support` });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteName("");
      setInviteNotes("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const exportWaitlist = () => {
    const csv = [
      ["Email", "Signed Up"].join(","),
      ...waitlist.map((entry) => [entry.email, entry.created_at].join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const filteredWaitlist = waitlist.filter((entry) =>
    entry.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredWhitelist = whitelist.filter((entry) =>
    entry.email.toLowerCase().includes(search.toLowerCase()) ||
    entry.invitee_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Waitlist & Invitations" description="Manage early access waitlist and invitations">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waitlist */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Waitlist ({waitlist.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={exportWaitlist}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search waitlist..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : filteredWaitlist.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No entries</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredWaitlist.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{entry.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addToWhitelist(entry.email)}>
                      <UserPlus className="h-3 w-3 mr-1" />
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invited Users ({whitelist.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : filteredWhitelist.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No invitations</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredWhitelist.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{entry.email}</p>
                      {entry.invitee_name && (
                        <p className="text-xs text-muted-foreground">{entry.invitee_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Invited {format(new Date(entry.invited_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    {entry.used_at ? (
                      <Badge variant="default">Signed Up</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User to Early Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address *</Label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                type="email"
              />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={inviteNotes}
                onChange={(e) => setInviteNotes(e.target.value)}
                placeholder="VIP customer, referral from..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? "Inviting..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWaitlist;
