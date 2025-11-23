# Task-Aware AI Personas

## Overview

The AI personas (Sam, James, Katy, Troy, and Gotti) now automatically reference and address known collection tasks when drafting messages. This ensures customers receive comprehensive, contextual responses that address their specific requests and concerns.

## How It Works

### 1. Automatic Task Extraction

When a customer responds to a collection message:
- The `log-collection-activity` function captures the response
- The `extract-collection-tasks` function analyzes the message using AI
- Tasks are automatically identified and categorized
- Tasks are stored with priority, due dates, and recommended actions

### 2. Task Types Identified

The system can identify 12+ types of customer requests:

| Task Type | Description | Example |
|-----------|-------------|---------|
| `w9_request` | Customer needs W9 tax form | "Can you send me a W9?" |
| `payment_plan_needed` | Requesting payment arrangement | "I need to set up a payment plan" |
| `incorrect_po` | Dispute over wrong PO number | "The PO number is wrong" |
| `dispute_charges` | Dispute over incorrect amounts | "I was charged incorrectly" |
| `invoice_copy_request` | Needs invoice resent | "I never received the invoice" |
| `billing_address_update` | Address needs correction | "Our billing address changed" |
| `payment_method_update` | Payment details need updating | "Update my credit card" |
| `service_not_delivered` | Claims service not received | "We never got the product" |
| `overpayment_inquiry` | Questions about double charges | "I think I was charged twice" |
| `paid_verification` | Claims already paid | "We already paid this" |
| `extension_request` | Asks for deadline extension | "Can we get 30 more days?" |
| `callback_required` | Requests phone call | "Please call me to discuss" |

### 3. Persona Integration

When generating a message, personas:

**Fetch Active Tasks:**
```typescript
const { data: openTasks } = await supabase
  .from('collection_tasks')
  .select('*')
  .eq('invoice_id', invoice_id)
  .in('status', ['open', 'in_progress'])
  .order('priority', { ascending: false });
```

**Include Task Context:**
The AI prompt includes:
- Task type and summary
- Recommended actions
- Customer's specific concerns
- Priority level

**Adapt Message Tone:**
Each persona maintains their characteristic tone while addressing tasks:
- **Sam (0-30 days):** Friendly acknowledgment with helpful next steps
- **James (31-60 days):** Professional and direct, with clear action items
- **Katy (61-90 days):** Assertive but fair, emphasizing resolution
- **Troy (91-120 days):** Firm but professional, urgent timeframes
- **Gotti (121+ days):** Very firm with serious urgency, final notices

## Examples

### Example 1: W9 Request

**Customer Response:**
> "We need your W9 form before we can process payment."

**Task Extracted:**
```json
{
  "task_type": "w9_request",
  "priority": "high",
  "summary": "Customer requires W9 form to process payment",
  "recommended_action": "Attach W9 form to response or send via separate email"
}
```

**Sam's Generated Message (0-30 days):**
> Subject: RE: Invoice #12345 - W9 Form Attached
>
> Hi [Customer Name],
>
> Thank you for letting us know! I've attached our W9 form to this email.
>
> Once you have everything you need, invoice #12345 for $5,000 can be paid via the link below:
> [Payment Link]
>
> Please let me know if you need anything else!
>
> Best regards,
> [Business Name]

### Example 2: Payment Plan Request + Incorrect PO

**Customer Response:**
> "We need to set up a payment plan, and also the PO number on this invoice is wrong - it should be PO-2024-456."

**Tasks Extracted:**
1. Payment plan needed (priority: high)
2. Incorrect PO (priority: urgent)

**James's Generated Message (31-60 days):**
> Subject: RE: Invoice #12345 - Payment Plan Available + PO Correction
>
> Hi [Customer Name],
>
> I can help with both items:
>
> 1. **PO Correction**: I'll update invoice #12345 with the correct PO number (PO-2024-456) and send you a revised copy within 24 hours.
>
> 2. **Payment Plan**: We're happy to set up a payment arrangement for the $5,000 balance. I can offer:
>    - 3 monthly payments of $1,667
>    - 6 monthly payments of $834
>
> Which option works better for you? Once we finalize the plan, I'll send over the agreement.
>
> Please let me know if you have any questions.
>
> [Payment Link]
>
> Best,
> [Business Name]

### Example 3: Multiple Issues (Dispute + Extension)

**Customer Response:**
> "We're disputing $2,000 of this invoice - those charges shouldn't be there. Also, we need more time to review the rest."

**Tasks Extracted:**
1. Dispute charges (priority: urgent)
2. Extension request (priority: normal)

**Katy's Generated Message (61-90 days):**
> Subject: Invoice #12345 - Addressing Your Dispute & Timeline
>
> [Customer Name],
>
> I understand there are concerns about this invoice. Let's resolve them:
>
> **Disputed Amount**: Please send me the specific line items you're questioning from the $5,000 balance, and I'll investigate immediately. I need this by [Date + 3 days] so we can review and respond.
>
> **Extension**: Once we resolve the dispute, I can grant a 15-day extension on the remaining balance. However, the account is now 75 days past due, so I'll need your commitment to this timeline.
>
> To keep this moving, please reply with:
> 1. Line items being disputed
> 2. Confirmation you'll pay the undisputed portion
>
> [Payment Link]
>
> I'm here to resolve this quickly.
>
> [Business Name]

## Benefits

1. **Reduced Response Time:** Personas immediately address customer concerns
2. **Improved Collection Rates:** Customers feel heard and are more likely to pay
3. **Fewer Back-and-Forth Emails:** Comprehensive responses in first contact
4. **Better Customer Experience:** Professional handling of disputes and requests
5. **Automatic Compliance:** No empty threats, always professional
6. **Audit Trail:** All tasks logged and tracked

## Task Management UI

Users can view and manage all tasks at `/collections/tasks`:
- **Kanban Board:** Open, In Progress, Done columns
- **Filters:** By status, priority, task type, debtor, invoice
- **Task Details:** Full context, AI reasoning, recommended actions
- **Status Updates:** Mark tasks complete, reassign, add notes

## API Integration

### Logging an Activity with Task Extraction

```typescript
import { useCollectionActivities } from '@/hooks/useCollectionActivities';

const { logActivity } = useCollectionActivities();

await logActivity({
  debtor_id: 'uuid',
  invoice_id: 'uuid',
  activity_type: 'inbound_email',
  direction: 'inbound',
  channel: 'email',
  message_body: 'Customer message...',
  response_message: 'Customer message...' // Triggers task extraction
});
```

### Fetching Tasks

```typescript
import { useCollectionTasks } from '@/hooks/useCollectionTasks';

const { fetchTasks } = useCollectionTasks();

const tasks = await fetchTasks({
  invoice_id: 'uuid',
  status: 'open'
});
```

## Future Enhancements

- [ ] Auto-complete tasks when customer pays
- [ ] Escalation rules for high-priority overdue tasks
- [ ] Task reminders and notifications
- [ ] Integration with external ticketing systems
- [ ] ML-based task priority adjustment
- [ ] Sentiment analysis for task urgency

## Support

For questions about task-aware personas, contact support@recouply.ai
