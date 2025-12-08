// Enterprise SaaS Account Hierarchy Types
// Following best practices for parent-child account relationships

export interface AccountMember {
  id: string;
  userId: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'disabled';
  isOwner: boolean;
  acceptedAt: string | null;
  invitedAt: string;
  profile: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface AccountOwner {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  planType: string | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface AccountHierarchyData {
  // The effective account ID (owner's ID for team members, own ID for owners)
  effectiveAccountId: string;
  
  // Current user's context
  currentUserId: string;
  isAccountOwner: boolean;
  memberRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  
  // Parent account info (populated for team members)
  parentAccount: AccountOwner | null;
  
  // All members in the account hierarchy
  members: AccountMember[];
  
  // Computed billing data
  billing: {
    planType: string | null;
    subscriptionStatus: string | null;
    billingInterval: string | null;
    billableSeats: number;
    totalMembers: number;
    activeMembers: number;
    pendingInvites: number;
    disabledMembers: number;
  };
  
  // Permissions based on role
  permissions: {
    canManageBilling: boolean;
    canInviteMembers: boolean;
    canManageRoles: boolean;
    canRemoveMembers: boolean;
    canViewBilling: boolean;
    canAccessData: boolean;
  };
}

export interface UseAccountHierarchyReturn extends AccountHierarchyData {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Helper to determine permissions based on role
export function getPermissionsForRole(role: string | null, isOwner: boolean): AccountHierarchyData['permissions'] {
  if (isOwner || role === 'owner') {
    return {
      canManageBilling: true,
      canInviteMembers: true,
      canManageRoles: true,
      canRemoveMembers: true,
      canViewBilling: true,
      canAccessData: true,
    };
  }
  
  if (role === 'admin') {
    return {
      canManageBilling: false,
      canInviteMembers: true,
      canManageRoles: true,
      canRemoveMembers: true,
      canViewBilling: true,
      canAccessData: true,
    };
  }
  
  if (role === 'member') {
    return {
      canManageBilling: false,
      canInviteMembers: false,
      canManageRoles: false,
      canRemoveMembers: false,
      canViewBilling: true,
      canAccessData: true,
    };
  }
  
  // viewer
  return {
    canManageBilling: false,
    canInviteMembers: false,
    canManageRoles: false,
    canRemoveMembers: false,
    canViewBilling: true,
    canAccessData: true,
  };
}
