export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_users: {
        Row: {
          accepted_at: string | null
          account_id: string
          created_at: string
          id: string
          invited_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          created_at?: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_user_actions: {
        Row: {
          action: string
          action_type: string | null
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string
        }
        Insert: {
          action: string
          action_type?: string | null
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id: string
        }
        Update: {
          action?: string
          action_type?: string | null
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      ai_agent_personas: {
        Row: {
          bucket_max: number | null
          bucket_min: number
          created_at: string | null
          id: string
          language_examples: string
          name: string
          persona_summary: string
          tone_guidelines: string
          updated_at: string | null
        }
        Insert: {
          bucket_max?: number | null
          bucket_min: number
          created_at?: string | null
          id?: string
          language_examples: string
          name: string
          persona_summary: string
          tone_guidelines: string
          updated_at?: string | null
        }
        Update: {
          bucket_max?: number | null
          bucket_min?: number
          created_at?: string | null
          id?: string
          language_examples?: string
          name?: string
          persona_summary?: string
          tone_guidelines?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_creations: {
        Row: {
          created_at: string | null
          created_debtor_id: string | null
          created_invoice_ids: Json | null
          id: string
          raw_prompt: string
          structured_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_debtor_id?: string | null
          created_invoice_ids?: Json | null
          id?: string
          raw_prompt: string
          structured_json: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_debtor_id?: string | null
          created_invoice_ids?: Json | null
          id?: string
          raw_prompt?: string
          structured_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_creations_created_debtor_id_fkey"
            columns: ["created_debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_drafts: {
        Row: {
          agent_persona_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string | null
          days_past_due: number | null
          id: string
          invoice_id: string
          message_body: string
          recommended_send_date: string | null
          status: Database["public"]["Enums"]["draft_status"] | null
          step_number: number
          subject: string | null
          updated_at: string | null
          user_id: string
          workflow_step_id: string | null
        }
        Insert: {
          agent_persona_id?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          days_past_due?: number | null
          id?: string
          invoice_id: string
          message_body: string
          recommended_send_date?: string | null
          status?: Database["public"]["Enums"]["draft_status"] | null
          step_number: number
          subject?: string | null
          updated_at?: string | null
          user_id: string
          workflow_step_id?: string | null
        }
        Update: {
          agent_persona_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          days_past_due?: number | null
          id?: string
          invoice_id?: string
          message_body?: string
          recommended_send_date?: string | null
          status?: Database["public"]["Enums"]["draft_status"] | null
          step_number?: number
          subject?: string | null
          updated_at?: string | null
          user_id?: string
          workflow_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_drafts_agent_persona_id_fkey"
            columns: ["agent_persona_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drafts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drafts_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "collection_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflows: {
        Row: {
          cadence_days: Json
          created_at: string | null
          id: string
          invoice_id: string
          is_active: boolean | null
          max_settlement_pct: number | null
          min_settlement_pct: number | null
          tone: Database["public"]["Enums"]["tone_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cadence_days: Json
          created_at?: string | null
          id?: string
          invoice_id: string
          is_active?: boolean | null
          max_settlement_pct?: number | null
          min_settlement_pct?: number | null
          tone?: Database["public"]["Enums"]["tone_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cadence_days?: Json
          created_at?: string | null
          id?: string
          invoice_id?: string
          is_active?: boolean | null
          max_settlement_pct?: number | null
          min_settlement_pct?: number | null
          tone?: Database["public"]["Enums"]["tone_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflows_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          business_name: string
          created_at: string | null
          email_footer: string | null
          email_signature: string | null
          from_email: string | null
          from_name: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          reply_to_email: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_name: string
          created_at?: string | null
          email_footer?: string | null
          email_signature?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          reply_to_email?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string | null
          email_footer?: string | null
          email_signature?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          reply_to_email?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      collection_workflow_steps: {
        Row: {
          ai_template_type: string
          body_template: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string | null
          day_offset: number
          id: string
          is_active: boolean | null
          label: string
          requires_review: boolean | null
          sms_template: string | null
          step_order: number
          subject_template: string | null
          trigger_type: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          ai_template_type: string
          body_template: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          day_offset: number
          id?: string
          is_active?: boolean | null
          label: string
          requires_review?: boolean | null
          sms_template?: string | null
          step_order: number
          subject_template?: string | null
          trigger_type: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          ai_template_type?: string
          body_template?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          day_offset?: number
          id?: string
          is_active?: boolean | null
          label?: string
          requires_review?: boolean | null
          sms_template?: string | null
          step_order?: number
          subject_template?: string | null
          trigger_type?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "collection_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_workflows: {
        Row: {
          aging_bucket: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_locked: boolean | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aging_bucket: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_locked?: boolean | null
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aging_bucket?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_locked?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          billing_system: string | null
          company: string
          created_at: string
          email: string
          id: string
          message: string | null
          monthly_invoices: string | null
          name: string
          team_size: string | null
        }
        Insert: {
          billing_system?: string | null
          company: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          monthly_invoices?: string | null
          name: string
          team_size?: string | null
        }
        Update: {
          billing_system?: string | null
          company?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          monthly_invoices?: string | null
          name?: string
          team_size?: string | null
        }
        Relationships: []
      }
      crm_accounts: {
        Row: {
          account_number: string | null
          created_at: string
          crm_account_id: string
          crm_type: string
          customer_since: string | null
          health_score: string | null
          id: string
          industry: string | null
          lifetime_value: number | null
          mrr: number | null
          name: string
          owner_name: string | null
          raw_json: Json | null
          segment: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          crm_account_id: string
          crm_type: string
          customer_since?: string | null
          health_score?: string | null
          id?: string
          industry?: string | null
          lifetime_value?: number | null
          mrr?: number | null
          name: string
          owner_name?: string | null
          raw_json?: Json | null
          segment?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          crm_account_id?: string
          crm_type?: string
          customer_since?: string | null
          health_score?: string | null
          id?: string
          industry?: string | null
          lifetime_value?: number | null
          mrr?: number | null
          name?: string
          owner_name?: string | null
          raw_json?: Json | null
          segment?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_connections: {
        Row: {
          access_token: string | null
          connected_at: string
          created_at: string
          crm_type: string
          id: string
          instance_url: string | null
          last_sync_at: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string
          created_at?: string
          crm_type: string
          id?: string
          instance_url?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string
          created_at?: string
          crm_type?: string
          id?: string
          instance_url?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debtors: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          ar_contact_email: string | null
          ar_contact_name: string | null
          ar_contact_phone: string | null
          avg_risk_score: number | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          city: string | null
          company_name: string
          contact_name: string
          country: string | null
          created_at: string | null
          credit_limit: number | null
          crm_account_id: string | null
          crm_account_id_external: string | null
          crm_system: string | null
          current_balance: number | null
          email: string
          external_customer_id: string | null
          external_system: string | null
          high_risk_invoice_count: number | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          max_risk_score: number | null
          name: string
          notes: string | null
          payment_terms_default: string | null
          phone: string | null
          postal_code: string | null
          primary_contact_name: string | null
          primary_email: string | null
          primary_phone: string | null
          reference_id: string
          risk_tier: string | null
          state: string | null
          tags: Json | null
          total_open_balance: number | null
          type: Database["public"]["Enums"]["debtor_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ar_contact_email?: string | null
          ar_contact_name?: string | null
          ar_contact_phone?: string | null
          avg_risk_score?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          city?: string | null
          company_name: string
          contact_name: string
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          crm_account_id?: string | null
          crm_account_id_external?: string | null
          crm_system?: string | null
          current_balance?: number | null
          email: string
          external_customer_id?: string | null
          external_system?: string | null
          high_risk_invoice_count?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_risk_score?: number | null
          name: string
          notes?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_contact_name?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          reference_id: string
          risk_tier?: string | null
          state?: string | null
          tags?: Json | null
          total_open_balance?: number | null
          type?: Database["public"]["Enums"]["debtor_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ar_contact_email?: string | null
          ar_contact_name?: string | null
          ar_contact_phone?: string | null
          avg_risk_score?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          crm_account_id?: string | null
          crm_account_id_external?: string | null
          crm_system?: string | null
          current_balance?: number | null
          email?: string
          external_customer_id?: string | null
          external_system?: string | null
          high_risk_invoice_count?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_risk_score?: number | null
          name?: string
          notes?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_contact_name?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          reference_id?: string
          risk_tier?: string | null
          state?: string | null
          tags?: Json | null
          total_open_balance?: number | null
          type?: Database["public"]["Enums"]["debtor_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtors_crm_account_id_fkey"
            columns: ["crm_account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity?: number
          sort_order?: number
          unit_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_usage: {
        Row: {
          created_at: string | null
          id: string
          included_invoices_used: number
          last_updated_at: string | null
          month: string
          overage_charges_total: number
          overage_invoices: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          included_invoices_used?: number
          last_updated_at?: string | null
          month: string
          overage_charges_total?: number
          overage_invoices?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          included_invoices_used?: number
          last_updated_at?: string | null
          month?: string
          overage_charges_total?: number
          overage_invoices?: number
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          debtor_id: string
          due_date: string
          external_link: string | null
          id: string
          invoice_number: string
          is_overage: boolean | null
          issue_date: string
          last_contact_date: string | null
          next_contact_date: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_terms: string | null
          payment_terms_days: number | null
          promise_to_pay_amount: number | null
          promise_to_pay_date: string | null
          reference_id: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          debtor_id: string
          due_date: string
          external_link?: string | null
          id?: string
          invoice_number: string
          is_overage?: boolean | null
          issue_date: string
          last_contact_date?: string | null
          next_contact_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          payment_terms_days?: number | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          reference_id: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          debtor_id?: string
          due_date?: string
          external_link?: string | null
          id?: string
          invoice_number?: string
          is_overage?: boolean | null
          issue_date?: string
          last_contact_date?: string | null
          next_contact_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          payment_terms_days?: number | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          reference_id?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_snippets: {
        Row: {
          created_at: string
          id: string
          industry: string
          problem_copy: string
          results_copy: string
          solution_copy: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry: string
          problem_copy: string
          results_copy: string
          solution_copy: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string
          problem_copy?: string
          results_copy?: string
          solution_copy?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_logs: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string | null
          debtor_id: string
          delivery_metadata: Json | null
          id: string
          invoice_id: string
          message_body: string
          sent_at: string | null
          sent_from: string | null
          sent_to: string
          status: Database["public"]["Enums"]["outreach_log_status"] | null
          subject: string | null
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          debtor_id: string
          delivery_metadata?: Json | null
          id?: string
          invoice_id: string
          message_body: string
          sent_at?: string | null
          sent_from?: string | null
          sent_to: string
          status?: Database["public"]["Enums"]["outreach_log_status"] | null
          subject?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          debtor_id?: string
          delivery_metadata?: Json | null
          id?: string
          invoice_id?: string
          message_body?: string
          sent_at?: string | null
          sent_from?: string | null
          sent_to?: string
          status?: Database["public"]["Enums"]["outreach_log_status"] | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_logs_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          feature_flags: Json
          id: string
          invoice_limit: number | null
          monthly_price: number | null
          name: string
          overage_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_flags?: Json
          id?: string
          invoice_limit?: number | null
          monthly_price?: number | null
          name: string
          overage_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_flags?: Json
          id?: string
          invoice_limit?: number | null
          monthly_price?: number | null
          name?: string
          overage_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_autocomplete_api_key: string | null
          address_autocomplete_enabled: boolean | null
          address_autocomplete_provider: string | null
          avatar_url: string | null
          business_address: string | null
          business_address_line1: string | null
          business_address_line2: string | null
          business_city: string | null
          business_country: string | null
          business_name: string | null
          business_phone: string | null
          business_postal_code: string | null
          business_state: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          name: string | null
          password_hash: string | null
          phone: string | null
          plan_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          sendgrid_api_key: string | null
          smtp_settings: Json | null
          stripe_customer_id: string | null
          stripe_payment_link_url: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_from_number: string | null
          updated_at: string | null
        }
        Insert: {
          address_autocomplete_api_key?: string | null
          address_autocomplete_enabled?: boolean | null
          address_autocomplete_provider?: string | null
          avatar_url?: string | null
          business_address?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_city?: string | null
          business_country?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          name?: string | null
          password_hash?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          sendgrid_api_key?: string | null
          smtp_settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_link_url?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address_autocomplete_api_key?: string | null
          address_autocomplete_enabled?: boolean | null
          address_autocomplete_provider?: string | null
          avatar_url?: string | null
          business_address?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_city?: string | null
          business_country?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          name?: string | null
          password_hash?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          sendgrid_api_key?: string | null
          smtp_settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_link_url?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_overrides: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          updated_at: string
          updated_by_admin_id: string | null
          user_id: string
          value: boolean
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          updated_at?: string
          updated_by_admin_id?: string | null
          user_id: string
          value: boolean
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          updated_at?: string
          updated_by_admin_id?: string | null
          user_id?: string
          value?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_reference_id: {
        Args: { prefix: string; target_table: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_manager: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_recouply_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer"
      channel_type: "email" | "sms"
      debtor_type: "B2B" | "B2C"
      draft_status: "pending_approval" | "approved" | "discarded"
      invoice_status:
        | "Open"
        | "Paid"
        | "Disputed"
        | "Settled"
        | "InPaymentPlan"
        | "Canceled"
      outreach_log_status: "sent" | "failed" | "queued"
      outreach_status: "draft" | "scheduled" | "sent" | "failed"
      plan_type: "free" | "starter" | "growth" | "pro"
      tone_type: "friendly" | "firm" | "neutral"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "member", "viewer"],
      channel_type: ["email", "sms"],
      debtor_type: ["B2B", "B2C"],
      draft_status: ["pending_approval", "approved", "discarded"],
      invoice_status: [
        "Open",
        "Paid",
        "Disputed",
        "Settled",
        "InPaymentPlan",
        "Canceled",
      ],
      outreach_log_status: ["sent", "failed", "queued"],
      outreach_status: ["draft", "scheduled", "sent", "failed"],
      plan_type: ["free", "starter", "growth", "pro"],
      tone_type: ["friendly", "firm", "neutral"],
    },
  },
} as const
