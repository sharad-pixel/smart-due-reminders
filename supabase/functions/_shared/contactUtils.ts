/**
 * Shared utility functions for fetching outreach contacts
 * 
 * Logic:
 * 1. Fetch all contacts from debtor_contacts with outreach_enabled=true
 * 2. If no contacts found, fallback to debtor record email/phone
 * 3. Return array of contacts for multi-recipient support
 */

export interface OutreachContact {
  email: string | null;
  phone: string | null;
  name: string | null;
  isPrimary: boolean;
  source: 'debtor_contacts' | 'debtor_record';
}

export interface OutreachResult {
  emails: string[];
  phones: string[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  primaryName: string | null;
  contacts: OutreachContact[];
}

/**
 * Get all outreach-enabled contacts for a debtor
 * Falls back to debtor record email/phone if no contacts exist
 */
export async function getOutreachContacts(
  supabaseClient: any,
  debtorId: string,
  debtor?: { email?: string | null; phone?: string | null; company_name?: string | null }
): Promise<OutreachResult> {
  const result: OutreachResult = {
    emails: [],
    phones: [],
    primaryEmail: null,
    primaryPhone: null,
    primaryName: null,
    contacts: [],
  };

  // Fetch all contacts with outreach_enabled=true from debtor_contacts
  const { data: contacts } = await supabaseClient
    .from("debtor_contacts")
    .select("name, email, phone, is_primary, outreach_enabled")
    .eq("debtor_id", debtorId)
    .eq("outreach_enabled", true)
    .order("is_primary", { ascending: false });

  if (contacts && contacts.length > 0) {
    // Process all outreach-enabled contacts
    for (const contact of contacts) {
      const outreachContact: OutreachContact = {
        email: contact.email || null,
        phone: contact.phone || null,
        name: contact.name || null,
        isPrimary: contact.is_primary || false,
        source: 'debtor_contacts',
      };
      result.contacts.push(outreachContact);

      if (contact.email) {
        result.emails.push(contact.email);
      }
      if (contact.phone) {
        result.phones.push(contact.phone);
      }

      // Set primary contact info
      if (contact.is_primary) {
        result.primaryEmail = contact.email || result.primaryEmail;
        result.primaryPhone = contact.phone || result.primaryPhone;
        result.primaryName = contact.name || result.primaryName;
      }
    }

    // If no primary was explicitly set, use first contact
    if (!result.primaryEmail && result.emails.length > 0) {
      result.primaryEmail = result.emails[0];
    }
    if (!result.primaryPhone && result.phones.length > 0) {
      result.primaryPhone = result.phones[0];
    }
    if (!result.primaryName && result.contacts.length > 0) {
      result.primaryName = result.contacts[0].name;
    }
  }

  // Fallback to debtor record email/phone only if no contacts exist
  if (result.emails.length === 0 && debtor?.email) {
    console.log(`[contactUtils] Using fallback email from debtor record: ${debtor.email}`);
    result.emails.push(debtor.email);
    result.primaryEmail = debtor.email;
    result.contacts.push({
      email: debtor.email,
      phone: debtor.phone || null,
      name: debtor.company_name || null,
      isPrimary: true,
      source: 'debtor_record',
    });
  }

  if (result.phones.length === 0 && debtor?.phone) {
    console.log(`[contactUtils] Using fallback phone from debtor record: ${debtor.phone}`);
    result.phones.push(debtor.phone);
    result.primaryPhone = debtor.phone;
  }

  if (!result.primaryName && debtor) {
    result.primaryName = debtor.company_name || null;
  }

  console.log(`[contactUtils] Found ${result.emails.length} email(s), ${result.phones.length} phone(s) for debtor ${debtorId}`);
  
  return result;
}
