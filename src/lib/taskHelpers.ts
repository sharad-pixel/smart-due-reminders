/**
 * Task Helper Utilities
 * 
 * Functions for working with the automated task system, including:
 * - Generating subaddressed email addresses for inbound routing
 * - Formatting task types
 * - Classifying tasks
 */

/**
 * Generates a subaddressed email for invoice-level communication
 * 
 * Usage: When sending emails about a specific invoice, use this address
 * as the reply-to so that customer replies automatically create invoice-level tasks
 * 
 * @param invoiceId - UUID of the invoice
 * @returns Email address like invoice+<uuid>@recouply.ai
 */
export function getInvoiceReplyEmail(invoiceId: string): string {
  return `invoice+${invoiceId}@recouply.ai`;
}

/**
 * Generates a subaddressed email for debtor-level communication
 * 
 * Usage: When sending general account communication, use this address
 * as the reply-to so that customer replies automatically create debtor-level tasks
 * 
 * @param debtorId - UUID of the debtor
 * @returns Email address like debtor+<uuid>@recouply.ai
 */
export function getDebtorReplyEmail(debtorId: string): string {
  return `debtor+${debtorId}@recouply.ai`;
}

/**
 * Formats a task type enum into a human-readable string
 * 
 * @param taskType - Task type enum (e.g., SETUP_PAYMENT_PLAN)
 * @returns Formatted string (e.g., "Setup Payment Plan")
 */
export function formatTaskType(taskType: string): string {
  return taskType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Gets the priority for a task based on its type
 * 
 * @param taskType - Task type enum
 * @returns Priority level: high, normal, or low
 */
export function getTaskPriority(taskType: string): 'high' | 'normal' | 'low' {
  const highPriorityTypes = ['REVIEW_DISPUTE', 'CALL_CUSTOMER'];
  const lowPriorityTypes = ['MANUAL_REVIEW'];
  
  if (highPriorityTypes.includes(taskType)) return 'high';
  if (lowPriorityTypes.includes(taskType)) return 'low';
  return 'normal';
}

/**
 * Classifies task type from email content (client-side validation)
 * Note: The edge function also does this classification
 * 
 * @param content - Email text content
 * @returns Task type enum
 */
export function classifyTaskType(content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes("payment plan") || 
      lowerContent.includes("installments") || 
      lowerContent.includes("cannot pay in full")) {
    return "SETUP_PAYMENT_PLAN";
  }
  
  if (lowerContent.includes("dispute") || 
      lowerContent.includes("wrong amount") || 
      lowerContent.includes("not my invoice")) {
    return "REVIEW_DISPUTE";
  }
  
  if (lowerContent.includes("call me") || 
      lowerContent.includes("phone call") || 
      lowerContent.includes("call back")) {
    return "CALL_CUSTOMER";
  }
  
  if (lowerContent.includes("update card") || 
      lowerContent.includes("new card") || 
      lowerContent.includes("payment method")) {
    return "UPDATE_PAYMENT_METHOD";
  }
  
  if (lowerContent.includes("pay now") || 
      lowerContent.includes("ready to pay") || 
      lowerContent.includes("send link")) {
    return "SEND_PAYMENT_LINK";
  }
  
  return "MANUAL_REVIEW";
}

/**
 * Gets a description for a task type
 * 
 * @param taskType - Task type enum
 * @returns Human-readable description
 */
export function getTaskTypeDescription(taskType: string): string {
  const descriptions: Record<string, string> = {
    'SETUP_PAYMENT_PLAN': 'Customer requesting payment plan or installment arrangement',
    'REVIEW_DISPUTE': 'Customer disputing invoice amount or validity',
    'CALL_CUSTOMER': 'Customer requesting a phone call',
    'UPDATE_PAYMENT_METHOD': 'Customer needs to update payment method',
    'SEND_PAYMENT_LINK': 'Customer ready to pay, needs payment link',
    'MANUAL_REVIEW': 'Requires manual review and classification',
  };
  
  return descriptions[taskType] || 'General customer inquiry';
}
