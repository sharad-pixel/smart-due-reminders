import { useMemo } from "react";
import { useUserRole } from "./useUserRole";

/**
 * Role-based access control hook
 * Defines what each role can do in the application
 * 
 * Roles hierarchy:
 * - owner: Full access, manages billing and team
 * - admin: Full access except billing ownership
 * - member: Can create/edit data but not manage team or billing
 * - viewer: Read-only access
 */
export const useRoleAccess = () => {
  const { role, loading, canManageBilling } = useUserRole();

  const permissions = useMemo(() => {
    const isOwnerOrAdmin = role === 'owner' || role === 'admin';
    const canEdit = role === 'owner' || role === 'admin' || role === 'member';
    const isViewer = role === 'viewer';
    
    return {
      // Team & Role Management
      canInviteTeamMembers: isOwnerOrAdmin,
      canChangeRoles: isOwnerOrAdmin,
      canRemoveTeamMembers: isOwnerOrAdmin,
      canViewTeamMembers: true, // All roles can view
      
      // Billing
      canManageBilling,
      canViewBilling: isOwnerOrAdmin,
      
      // Tasks - Viewers can view but not be assigned or create
      canAssignTasks: canEdit,
      canBeAssignedTasks: !isViewer, // Viewers cannot be assigned tasks
      canCreateTasks: canEdit,
      canEditTasks: canEdit,
      canDeleteTasks: isOwnerOrAdmin,
      canViewTasks: true,
      
      // Invoices & Debtors
      canCreateInvoices: canEdit,
      canEditInvoices: canEdit,
      canDeleteInvoices: isOwnerOrAdmin,
      canCreateDebtors: canEdit,
      canEditDebtors: canEdit,
      canDeleteDebtors: isOwnerOrAdmin,
      
      // AI Workflows
      canManageWorkflows: canEdit,
      canApproveAIDrafts: canEdit,
      canSendCollectionMessages: canEdit,
      
      // Settings
      canEditSettings: isOwnerOrAdmin,
      canEditBranding: isOwnerOrAdmin,
      
      // Documents - Only admins can overwrite existing documents
      canUploadDocuments: canEdit,
      canOverwriteDocuments: isOwnerOrAdmin, // Only owner/admin can replace existing
      canDeleteDocuments: isOwnerOrAdmin,
      canViewDocuments: true,
      
      // Data Center
      canImportData: canEdit,
      canExportData: true,
      
      // Reports
      canViewReports: true,
      canExportReports: true,
    };
  }, [role, canManageBilling]);

  return {
    role,
    loading,
    permissions,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isMember: role === 'member',
    isViewer: role === 'viewer',
  };
};
