import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Users, ChevronDown, Building2, Mail, Shield, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  is_owner: boolean;
  accepted_at: string | null;
  profile?: {
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    company_name: string | null;
    plan_type: string | null;
    subscription_status: string | null;
  } | null;
}

interface AccountHierarchyProps {
  compact?: boolean;
}

export function AccountHierarchy({ compact = false }: AccountHierarchyProps) {
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<TeamMember | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      // Get effective account ID
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });

      const accountId = effectiveAccountId || user.id;

      // Fetch all account users for this account
      const { data: accountUsers, error } = await supabase
        .from('account_users')
        .select(`
          id,
          user_id,
          email,
          role,
          status,
          is_owner,
          accepted_at
        `)
        .eq('account_id', accountId)
        .order('is_owner', { ascending: false })
        .order('role', { ascending: true });

      if (error) {
        console.error('Error fetching account hierarchy:', error);
        return;
      }

      // Fetch profiles for users
      const userIds = accountUsers?.filter(au => au.user_id).map(au => au.user_id) || [];
      let profileMap = new Map<string, any>();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, company_name, plan_type, subscription_status')
          .in('id', userIds);
        
        profileMap = new Map((profiles || []).map(p => [p.id, {
          display_name: p.name,
          email: p.email,
          avatar_url: p.avatar_url,
          company_name: p.company_name,
          plan_type: p.plan_type,
          subscription_status: p.subscription_status
        }]));
      }

      const enrichedMembers: TeamMember[] = (accountUsers || []).map(au => ({
        ...au,
        profile: au.user_id ? profileMap.get(au.user_id) || null : null
      }));

      // Separate owner from team members
      const ownerMember = enrichedMembers.find(m => m.is_owner);
      const teamMembers = enrichedMembers.filter(m => !m.is_owner && m.status === 'active');

      setOwner(ownerMember || null);
      setMembers(teamMembers);
    } catch (error) {
      console.error('Error loading hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">
          <Crown className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      );
    }
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      case 'manager':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <UserCheck className="h-3 w-3 mr-1" />
            Manager
          </Badge>
        );
      case 'viewer':
        return (
          <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            <User className="h-3 w-3 mr-1" />
            Viewer
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="capitalize">
            {role}
          </Badge>
        );
    }
  };

  const getPlanBadge = (planType: string | null | undefined) => {
    if (!planType) return null;
    const colors: Record<string, string> = {
      free: 'bg-gray-500/10 text-gray-600',
      starter: 'bg-blue-500/10 text-blue-600',
      growth: 'bg-green-500/10 text-green-600',
      professional: 'bg-purple-500/10 text-purple-600',
      enterprise: 'bg-amber-500/10 text-amber-600',
    };
    return (
      <Badge className={colors[planType] || 'bg-gray-500/10 text-gray-600'}>
        {planType.charAt(0).toUpperCase() + planType.slice(1)} Plan
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!owner) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className={cn(
          "bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5",
          compact && "cursor-pointer hover:bg-primary/10 transition-colors"
        )}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Account Hierarchy</CardTitle>
          </div>
          {compact && (
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )} />
          )}
        </div>
        <CardDescription>
          Organization structure and team members ({members.length + 1} total)
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-6">
          {/* Visual Hierarchy Tree */}
          <div className="relative">
            {/* Owner Node - Root */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "relative flex flex-col items-center p-4 rounded-xl border-2 bg-gradient-to-b from-primary/5 to-primary/10",
                owner.user_id === currentUserId ? "border-primary ring-2 ring-primary/20" : "border-primary/30"
              )}>
                {/* Crown indicator */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full p-1.5">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                </div>
                
                <Avatar className="h-16 w-16 border-2 border-primary/20 mt-2">
                  <AvatarImage src={owner.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                    {(owner.profile?.display_name || owner.profile?.email || owner.email || 'O')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="mt-3 text-center">
                  <p className="font-semibold text-lg">
                    {owner.profile?.display_name || 'Account Owner'}
                    {owner.user_id === currentUserId && (
                      <span className="text-xs text-muted-foreground ml-1">(You)</span>
                    )}
                  </p>
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {owner.profile?.email || owner.email}
                  </div>
                  {owner.profile?.company_name && (
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3" />
                      {owner.profile.company_name}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-3">
                  {getRoleBadge(owner.role, true)}
                  {getPlanBadge(owner.profile?.plan_type)}
                </div>
              </div>

              {/* Connector line to children */}
              {members.length > 0 && (
                <div className="w-0.5 h-8 bg-gradient-to-b from-primary/30 to-border" />
              )}
            </div>

            {/* Team Members */}
            {members.length > 0 && (
              <div className="relative">
                {/* Horizontal connector */}
                <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-2xl h-0.5 bg-border" style={{ top: 0 }} />
                
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  {members.map((member, index) => (
                    <div key={member.id} className="relative flex flex-col items-center">
                      {/* Vertical connector from horizontal line */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border -mt-4" />
                      
                      <div className={cn(
                        "flex flex-col items-center p-3 rounded-lg border bg-card",
                        member.user_id === currentUserId ? "border-primary ring-2 ring-primary/20" : "border-border"
                      )}>
                        <Avatar className="h-12 w-12 border border-border">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {(member.profile?.display_name || member.profile?.email || member.email || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="mt-2 text-center max-w-[140px]">
                          <p className="font-medium text-sm truncate">
                            {member.profile?.display_name || 'Team Member'}
                            {member.user_id === currentUserId && (
                              <span className="text-xs text-muted-foreground ml-1">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.profile?.email || member.email}
                          </p>
                        </div>
                        
                        <div className="mt-2">
                          {getRoleBadge(member.role, false)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state for no team members */}
            {members.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No additional team members</p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
