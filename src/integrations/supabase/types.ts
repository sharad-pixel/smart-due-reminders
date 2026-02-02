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
          disabled_at: string | null
          email: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          is_owner: boolean | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          seat_billing_ends_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          is_owner?: boolean | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          seat_billing_ends_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          is_owner?: boolean | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          seat_billing_ends_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      ai_command_logs: {
        Row: {
          command_text: string
          context_type: string | null
          created_at: string
          draft_id: string | null
          id: string
          invoice_id: string | null
          persona_name: string | null
          user_id: string
        }
        Insert: {
          command_text: string
          context_type?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          invoice_id?: string | null
          persona_name?: string | null
          user_id: string
        }
        Update: {
          command_text?: string
          context_type?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          invoice_id?: string | null
          persona_name?: string | null
          user_id?: string
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
          applied_brand_snapshot: Json | null
          auto_approved: boolean | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string | null
          days_past_due: number | null
          id: string
          invoice_id: string | null
          message_body: string
          organization_id: string | null
          recommended_send_date: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["draft_status"] | null
          step_number: number
          subject: string | null
          updated_at: string | null
          user_id: string
          workflow_step_id: string | null
        }
        Insert: {
          agent_persona_id?: string | null
          applied_brand_snapshot?: Json | null
          auto_approved?: boolean | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          days_past_due?: number | null
          id?: string
          invoice_id?: string | null
          message_body: string
          organization_id?: string | null
          recommended_send_date?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["draft_status"] | null
          step_number: number
          subject?: string | null
          updated_at?: string | null
          user_id: string
          workflow_step_id?: string | null
        }
        Update: {
          agent_persona_id?: string | null
          applied_brand_snapshot?: Json | null
          auto_approved?: boolean | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string | null
          days_past_due?: number | null
          id?: string
          invoice_id?: string | null
          message_body?: string
          organization_id?: string | null
          recommended_send_date?: string | null
          sent_at?: string | null
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
            foreignKeyName: "ai_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      ar_page_access_logs: {
        Row: {
          accessed_at: string | null
          branding_settings_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          branding_settings_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          branding_settings_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_page_access_logs_branding_settings_id_fkey"
            columns: ["branding_settings_id"]
            isOneToOne: false
            referencedRelation: "branding_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_summary: {
        Row: {
          as_of_date: string
          bucket_1_30: number | null
          bucket_120_plus: number | null
          bucket_31_60: number | null
          bucket_61_90: number | null
          bucket_91_120: number | null
          bucket_current: number | null
          created_at: string
          debtor_id: string | null
          id: string
          upload_batch_id: string | null
          user_id: string
        }
        Insert: {
          as_of_date: string
          bucket_1_30?: number | null
          bucket_120_plus?: number | null
          bucket_31_60?: number | null
          bucket_61_90?: number | null
          bucket_91_120?: number | null
          bucket_current?: number | null
          created_at?: string
          debtor_id?: string | null
          id?: string
          upload_batch_id?: string | null
          user_id: string
        }
        Update: {
          as_of_date?: string
          bucket_1_30?: number | null
          bucket_120_plus?: number | null
          bucket_31_60?: number | null
          bucket_61_90?: number | null
          bucket_91_120?: number | null
          bucket_current?: number | null
          created_at?: string
          debtor_id?: string | null
          id?: string
          upload_batch_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_summary_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_summary_upload_batch_id_fkey"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "upload_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          ar_contact_email: string | null
          ar_page_enabled: boolean | null
          ar_page_last_updated_at: string | null
          ar_page_public_token: string | null
          auto_approve_drafts: boolean
          business_name: string
          created_at: string | null
          email_footer: string | null
          email_format: string | null
          email_signature: string | null
          email_wrapper_enabled: boolean | null
          escalation_contact_email: string | null
          escalation_contact_name: string | null
          escalation_contact_phone: string | null
          footer_disclaimer: string | null
          from_email: string | null
          from_email_verification_status: string | null
          from_email_verified: boolean | null
          from_name: string | null
          id: string
          last_test_email_sent_at: string | null
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          reply_to_email: string | null
          sending_mode: string | null
          stripe_payment_link: string | null
          supported_payment_methods: Json | null
          updated_at: string | null
          use_persona_signatures: boolean | null
          user_id: string
          verified_from_email: string | null
        }
        Insert: {
          accent_color?: string | null
          ar_contact_email?: string | null
          ar_page_enabled?: boolean | null
          ar_page_last_updated_at?: string | null
          ar_page_public_token?: string | null
          auto_approve_drafts?: boolean
          business_name: string
          created_at?: string | null
          email_footer?: string | null
          email_format?: string | null
          email_signature?: string | null
          email_wrapper_enabled?: boolean | null
          escalation_contact_email?: string | null
          escalation_contact_name?: string | null
          escalation_contact_phone?: string | null
          footer_disclaimer?: string | null
          from_email?: string | null
          from_email_verification_status?: string | null
          from_email_verified?: boolean | null
          from_name?: string | null
          id?: string
          last_test_email_sent_at?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          reply_to_email?: string | null
          sending_mode?: string | null
          stripe_payment_link?: string | null
          supported_payment_methods?: Json | null
          updated_at?: string | null
          use_persona_signatures?: boolean | null
          user_id: string
          verified_from_email?: string | null
        }
        Update: {
          accent_color?: string | null
          ar_contact_email?: string | null
          ar_page_enabled?: boolean | null
          ar_page_last_updated_at?: string | null
          ar_page_public_token?: string | null
          auto_approve_drafts?: boolean
          business_name?: string
          created_at?: string | null
          email_footer?: string | null
          email_format?: string | null
          email_signature?: string | null
          email_wrapper_enabled?: boolean | null
          escalation_contact_email?: string | null
          escalation_contact_name?: string | null
          escalation_contact_phone?: string | null
          footer_disclaimer?: string | null
          from_email?: string | null
          from_email_verification_status?: string | null
          from_email_verified?: boolean | null
          from_name?: string | null
          id?: string
          last_test_email_sent_at?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          reply_to_email?: string | null
          sending_mode?: string | null
          stripe_payment_link?: string | null
          supported_payment_methods?: Json | null
          updated_at?: string | null
          use_persona_signatures?: boolean | null
          user_id?: string
          verified_from_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_accounts: {
        Row: {
          amount_collected: number | null
          balance_at_assignment: number | null
          campaign_id: string
          created_at: string
          debtor_id: string
          id: string
          last_action_at: string | null
          notes: string | null
          risk_score_at_assignment: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_collected?: number | null
          balance_at_assignment?: number | null
          campaign_id: string
          created_at?: string
          debtor_id: string
          id?: string
          last_action_at?: string | null
          notes?: string | null
          risk_score_at_assignment?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_collected?: number | null
          balance_at_assignment?: number | null
          campaign_id?: string
          created_at?: string
          debtor_id?: string
          id?: string
          last_action_at?: string | null
          notes?: string | null
          risk_score_at_assignment?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "collection_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_accounts_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_outreach_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          day_offset: number
          id: string
          status: string
          step_number: number
          subject: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          day_offset?: number
          id?: string
          status?: string
          step_number: number
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          day_offset?: number
          id?: string
          status?: string
          step_number?: number
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_outreach_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_activities: {
        Row: {
          activity_type: string
          channel: string
          created_at: string | null
          debtor_id: string
          delivered_at: string | null
          direction: string
          id: string
          invoice_id: string | null
          linked_draft_id: string | null
          linked_outreach_log_id: string | null
          message_body: string
          metadata: Json | null
          opened_at: string | null
          organization_id: string | null
          responded_at: string | null
          response_message: string | null
          sent_at: string | null
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          channel: string
          created_at?: string | null
          debtor_id: string
          delivered_at?: string | null
          direction: string
          id?: string
          invoice_id?: string | null
          linked_draft_id?: string | null
          linked_outreach_log_id?: string | null
          message_body: string
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          responded_at?: string | null
          response_message?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          channel?: string
          created_at?: string | null
          debtor_id?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          invoice_id?: string | null
          linked_draft_id?: string | null
          linked_outreach_log_id?: string | null
          message_body?: string
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          responded_at?: string | null
          response_message?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_activities_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_linked_draft_id_fkey"
            columns: ["linked_draft_id"]
            isOneToOne: false
            referencedRelation: "ai_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_linked_outreach_log_id_fkey"
            columns: ["linked_outreach_log_id"]
            isOneToOne: false
            referencedRelation: "outreach_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_campaigns: {
        Row: {
          accounts_collected: number | null
          accounts_contacted: number | null
          ai_confidence_score: number | null
          ai_recommended_channel: string | null
          ai_recommended_tone: string | null
          ai_strategy: string | null
          amount_collected: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          max_balance: number | null
          max_days_past_due: number | null
          max_risk_score: number | null
          min_balance: number | null
          min_days_past_due: number | null
          min_risk_score: number | null
          name: string
          organization_id: string | null
          priority: number | null
          starts_at: string | null
          status: string
          target_risk_tier: string
          total_accounts: number | null
          total_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accounts_collected?: number | null
          accounts_contacted?: number | null
          ai_confidence_score?: number | null
          ai_recommended_channel?: string | null
          ai_recommended_tone?: string | null
          ai_strategy?: string | null
          amount_collected?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_balance?: number | null
          max_days_past_due?: number | null
          max_risk_score?: number | null
          min_balance?: number | null
          min_days_past_due?: number | null
          min_risk_score?: number | null
          name: string
          organization_id?: string | null
          priority?: number | null
          starts_at?: string | null
          status?: string
          target_risk_tier: string
          total_accounts?: number | null
          total_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accounts_collected?: number | null
          accounts_contacted?: number | null
          ai_confidence_score?: number | null
          ai_recommended_channel?: string | null
          ai_recommended_tone?: string | null
          ai_strategy?: string | null
          amount_collected?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_balance?: number | null
          max_days_past_due?: number | null
          max_risk_score?: number | null
          min_balance?: number | null
          min_days_past_due?: number | null
          min_risk_score?: number | null
          name?: string
          organization_id?: string | null
          priority?: number | null
          starts_at?: string | null
          status?: string
          target_risk_tier?: string
          total_accounts?: number | null
          total_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_outcomes: {
        Row: {
          activity_id: string | null
          amount: number | null
          created_at: string | null
          debtor_id: string
          dispute_reason: string | null
          dispute_status: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          outcome_details: Json | null
          outcome_type: string
          payment_date: string | null
          promise_to_pay_amount: number | null
          promise_to_pay_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          amount?: number | null
          created_at?: string | null
          debtor_id: string
          dispute_reason?: string | null
          dispute_status?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          outcome_details?: Json | null
          outcome_type: string
          payment_date?: string | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          amount?: number | null
          created_at?: string | null
          debtor_id?: string
          dispute_reason?: string | null
          dispute_status?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          outcome_details?: Json | null
          outcome_type?: string
          payment_date?: string | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_outcomes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "collection_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_outcomes_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_outcomes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_tasks: {
        Row: {
          activity_id: string | null
          ai_reasoning: string | null
          archived_at: string | null
          assigned_persona: string | null
          assigned_to: string | null
          assignment_email_sent_at: string | null
          completed_at: string | null
          created_at: string | null
          debtor_id: string
          details: string | null
          due_date: string | null
          from_email: string | null
          id: string
          inbound_email_id: string | null
          invoice_id: string | null
          is_archived: boolean | null
          level: string | null
          notes: Json | null
          organization_id: string | null
          original_email_body: string | null
          priority: string
          raw_email: string | null
          recommended_action: string | null
          response_includes_invoice: boolean | null
          response_includes_portal: boolean | null
          response_includes_w9: boolean | null
          response_sent_at: string | null
          response_sent_to: string | null
          response_status: string | null
          source: string | null
          status: string
          subject: string | null
          suggested_response_body: string | null
          suggested_response_subject: string | null
          summary: string
          task_type: string
          to_email: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          ai_reasoning?: string | null
          archived_at?: string | null
          assigned_persona?: string | null
          assigned_to?: string | null
          assignment_email_sent_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          debtor_id: string
          details?: string | null
          due_date?: string | null
          from_email?: string | null
          id?: string
          inbound_email_id?: string | null
          invoice_id?: string | null
          is_archived?: boolean | null
          level?: string | null
          notes?: Json | null
          organization_id?: string | null
          original_email_body?: string | null
          priority?: string
          raw_email?: string | null
          recommended_action?: string | null
          response_includes_invoice?: boolean | null
          response_includes_portal?: boolean | null
          response_includes_w9?: boolean | null
          response_sent_at?: string | null
          response_sent_to?: string | null
          response_status?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          suggested_response_body?: string | null
          suggested_response_subject?: string | null
          summary: string
          task_type: string
          to_email?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          ai_reasoning?: string | null
          archived_at?: string | null
          assigned_persona?: string | null
          assigned_to?: string | null
          assignment_email_sent_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          debtor_id?: string
          details?: string | null
          due_date?: string | null
          from_email?: string | null
          id?: string
          inbound_email_id?: string | null
          invoice_id?: string | null
          is_archived?: boolean | null
          level?: string | null
          notes?: Json | null
          organization_id?: string | null
          original_email_body?: string | null
          priority?: string
          raw_email?: string | null
          recommended_action?: string | null
          response_includes_invoice?: boolean | null
          response_includes_portal?: boolean | null
          response_includes_w9?: boolean | null
          response_sent_at?: string | null
          response_sent_to?: string | null
          response_status?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          suggested_response_body?: string | null
          suggested_response_subject?: string | null
          summary?: string
          task_type?: string
          to_email?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_tasks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "collection_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          is_step_approved: boolean | null
          label: string
          requires_review: boolean | null
          sms_template: string | null
          step_approved_at: string | null
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
          is_step_approved?: boolean | null
          label: string
          requires_review?: boolean | null
          sms_template?: string | null
          step_approved_at?: string | null
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
          is_step_approved?: boolean | null
          label?: string
          requires_review?: boolean | null
          sms_template?: string | null
          step_approved_at?: string | null
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
          auto_generate_drafts: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_locked: boolean | null
          is_template_approved: boolean | null
          name: string
          persona_id: string | null
          template_approved_at: string | null
          template_approved_by: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aging_bucket: string
          auto_generate_drafts?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_locked?: boolean | null
          is_template_approved?: boolean | null
          name: string
          persona_id?: string | null
          template_approved_at?: string | null
          template_approved_by?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aging_bucket?: string
          auto_generate_drafts?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_locked?: boolean | null
          is_template_approved?: boolean | null
          name?: string
          persona_id?: string | null
          template_approved_at?: string | null
          template_approved_by?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_workflows_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_personas"
            referencedColumns: ["id"]
          },
        ]
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
      contacts: {
        Row: {
          created_at: string | null
          debtor_id: string
          email: string | null
          external_contact_id: string
          first_name: string | null
          id: string
          is_primary: boolean | null
          last_name: string | null
          name: string | null
          phone: string | null
          raw: Json | null
          source: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          debtor_id: string
          email?: string | null
          external_contact_id: string
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
          raw?: Json | null
          source?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          debtor_id?: string
          email?: string | null
          external_contact_id?: string
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
          raw?: Json | null
          source?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
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
      cs_cases: {
        Row: {
          assigned_to: string | null
          case_number: string | null
          case_origin: string | null
          case_type: string | null
          closed_at: string | null
          created_at: string
          debtor_id: string
          description: string | null
          external_case_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          opened_at: string | null
          priority: string | null
          raw_json: Json | null
          resolution: string | null
          source_system: string | null
          status: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          case_number?: string | null
          case_origin?: string | null
          case_type?: string | null
          closed_at?: string | null
          created_at?: string
          debtor_id: string
          description?: string | null
          external_case_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          opened_at?: string | null
          priority?: string | null
          raw_json?: Json | null
          resolution?: string | null
          source_system?: string | null
          status?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: string | null
          case_origin?: string | null
          case_type?: string | null
          closed_at?: string | null
          created_at?: string
          debtor_id?: string
          description?: string | null
          external_case_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          opened_at?: string | null
          priority?: string | null
          raw_json?: Json | null
          resolution?: string | null
          source_system?: string | null
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_cases_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_cases_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_digests: {
        Row: {
          ar_1_30: number | null
          ar_120_plus: number | null
          ar_31_60: number | null
          ar_61_90: number | null
          ar_91_120: number | null
          ar_current: number | null
          collection_trend: string | null
          created_at: string | null
          digest_date: string
          email_sent_at: string | null
          health_label: string | null
          health_score: number | null
          high_risk_ar_outstanding: number | null
          high_risk_customers_count: number | null
          id: string
          open_tasks_count: number | null
          organization_id: string | null
          overdue_tasks_count: number | null
          payments_collected_last_7_days: number | null
          payments_collected_prev_7_days: number | null
          payments_collected_today: number | null
          tasks_created_today: number | null
          total_ar_outstanding: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ar_1_30?: number | null
          ar_120_plus?: number | null
          ar_31_60?: number | null
          ar_61_90?: number | null
          ar_91_120?: number | null
          ar_current?: number | null
          collection_trend?: string | null
          created_at?: string | null
          digest_date: string
          email_sent_at?: string | null
          health_label?: string | null
          health_score?: number | null
          high_risk_ar_outstanding?: number | null
          high_risk_customers_count?: number | null
          id?: string
          open_tasks_count?: number | null
          organization_id?: string | null
          overdue_tasks_count?: number | null
          payments_collected_last_7_days?: number | null
          payments_collected_prev_7_days?: number | null
          payments_collected_today?: number | null
          tasks_created_today?: number | null
          total_ar_outstanding?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ar_1_30?: number | null
          ar_120_plus?: number | null
          ar_31_60?: number | null
          ar_61_90?: number | null
          ar_91_120?: number | null
          ar_current?: number | null
          collection_trend?: string | null
          created_at?: string | null
          digest_date?: string
          email_sent_at?: string | null
          health_label?: string | null
          health_score?: number | null
          high_risk_ar_outstanding?: number | null
          high_risk_customers_count?: number | null
          id?: string
          open_tasks_count?: number | null
          organization_id?: string | null
          overdue_tasks_count?: number | null
          payments_collected_last_7_days?: number | null
          payments_collected_prev_7_days?: number | null
          payments_collected_today?: number | null
          tasks_created_today?: number | null
          total_ar_outstanding?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_digests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage_limits: {
        Row: {
          ai_commands_count: number | null
          api_calls_count: number | null
          created_at: string | null
          email_sends_count: number | null
          file_uploads_count: number | null
          id: string
          updated_at: string | null
          usage_date: string | null
          user_id: string
        }
        Insert: {
          ai_commands_count?: number | null
          api_calls_count?: number | null
          created_at?: string | null
          email_sends_count?: number | null
          file_uploads_count?: number | null
          id?: string
          updated_at?: string | null
          usage_date?: string | null
          user_id: string
        }
        Update: {
          ai_commands_count?: number | null
          api_calls_count?: number | null
          created_at?: string | null
          email_sends_count?: number | null
          file_uploads_count?: number | null
          id?: string
          updated_at?: string | null
          usage_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      data_center_custom_fields: {
        Row: {
          created_at: string
          data_type: string
          description: string | null
          grouping: string
          id: string
          key: string
          label: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_type?: string
          description?: string | null
          grouping?: string
          id?: string
          key: string
          label: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_type?: string
          description?: string | null
          grouping?: string
          id?: string
          key?: string
          label?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_center_custom_fields_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_center_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_center_field_definitions: {
        Row: {
          created_at: string
          data_type: string
          description: string | null
          grouping: string
          id: string
          key: string
          label: string
          required_for_recouply: boolean
          required_for_roundtrip: boolean
        }
        Insert: {
          created_at?: string
          data_type: string
          description?: string | null
          grouping: string
          id?: string
          key: string
          label: string
          required_for_recouply?: boolean
          required_for_roundtrip?: boolean
        }
        Update: {
          created_at?: string
          data_type?: string
          description?: string | null
          grouping?: string
          id?: string
          key?: string
          label?: string
          required_for_recouply?: boolean
          required_for_roundtrip?: boolean
        }
        Relationships: []
      }
      data_center_source_field_mappings: {
        Row: {
          confidence_score: number | null
          confirmed_field_key: string | null
          created_at: string
          file_column_name: string
          id: string
          inferred_field_key: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          confirmed_field_key?: string | null
          created_at?: string
          file_column_name: string
          id?: string
          inferred_field_key?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          confirmed_field_key?: string | null
          created_at?: string
          file_column_name?: string
          id?: string
          inferred_field_key?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_center_source_field_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_center_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_center_sources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string | null
          source_name: string
          system_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          source_name: string
          system_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          source_name?: string
          system_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_center_staging_rows: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          match_confidence: number | null
          match_status: string
          matched_customer_id: string | null
          matched_invoice_id: string | null
          normalized_json: Json | null
          raw_json: Json
          row_index: number
          upload_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          matched_customer_id?: string | null
          matched_invoice_id?: string | null
          normalized_json?: Json | null
          raw_json: Json
          row_index: number
          upload_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          matched_customer_id?: string | null
          matched_invoice_id?: string | null
          normalized_json?: Json | null
          raw_json?: Json
          row_index?: number
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_center_staging_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "data_center_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      data_center_uploads: {
        Row: {
          archived_at: string | null
          created_at: string
          deletion_warning_sent_at: string | null
          error_message: string | null
          file_name: string
          file_type: string
          file_url: string | null
          id: string
          matched_count: number | null
          processed_at: string | null
          processed_count: number | null
          row_count: number | null
          source_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          deletion_warning_sent_at?: string | null
          error_message?: string | null
          file_name: string
          file_type: string
          file_url?: string | null
          id?: string
          matched_count?: number | null
          processed_at?: string | null
          processed_count?: number | null
          row_count?: number | null
          source_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          deletion_warning_sent_at?: string | null
          error_message?: string | null
          file_name?: string
          file_type?: string
          file_url?: string | null
          id?: string
          matched_count?: number | null
          processed_at?: string | null
          processed_count?: number | null
          row_count?: number | null
          source_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_center_uploads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_center_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          notification_type: string
          read_at: string | null
          upload_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          notification_type: string
          read_at?: string | null
          upload_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          notification_type?: string
          read_at?: string | null
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_notifications_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "data_center_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      debtor_contacts: {
        Row: {
          created_at: string
          debtor_id: string
          email: string | null
          external_contact_id: string | null
          id: string
          is_primary: boolean
          name: string
          organization_id: string | null
          outreach_enabled: boolean
          phone: string | null
          source: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debtor_id: string
          email?: string | null
          external_contact_id?: string | null
          id?: string
          is_primary?: boolean
          name: string
          organization_id?: string | null
          outreach_enabled?: boolean
          phone?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debtor_id?: string
          email?: string | null
          external_contact_id?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          organization_id?: string | null
          outreach_enabled?: boolean
          phone?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtor_contacts_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtor_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      debtor_risk_history: {
        Row: {
          ai_sentiment_score: number | null
          basis_days_observed: number | null
          basis_invoices_count: number | null
          basis_payments_count: number | null
          calculation_details: Json | null
          collections_health_score: number | null
          collections_risk_score: number | null
          created_at: string
          debtor_id: string
          health_tier: string | null
          id: string
          risk_payment_score: number | null
          risk_status_note: string | null
          risk_tier: string | null
          score_components: Json | null
          snapshot_at: string
          user_id: string
        }
        Insert: {
          ai_sentiment_score?: number | null
          basis_days_observed?: number | null
          basis_invoices_count?: number | null
          basis_payments_count?: number | null
          calculation_details?: Json | null
          collections_health_score?: number | null
          collections_risk_score?: number | null
          created_at?: string
          debtor_id: string
          health_tier?: string | null
          id?: string
          risk_payment_score?: number | null
          risk_status_note?: string | null
          risk_tier?: string | null
          score_components?: Json | null
          snapshot_at?: string
          user_id: string
        }
        Update: {
          ai_sentiment_score?: number | null
          basis_days_observed?: number | null
          basis_invoices_count?: number | null
          basis_payments_count?: number | null
          calculation_details?: Json | null
          collections_health_score?: number | null
          collections_risk_score?: number | null
          created_at?: string
          debtor_id?: string
          health_tier?: string | null
          id?: string
          risk_payment_score?: number | null
          risk_status_note?: string | null
          risk_tier?: string | null
          score_components?: Json | null
          snapshot_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtor_risk_history_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      debtors: {
        Row: {
          account_outreach_enabled: boolean | null
          account_outreach_persona: string | null
          account_outreach_tone: number | null
          address: string | null
          address_line1: string | null
          address_line2: string | null
          aging_mix_1_30_pct: number | null
          aging_mix_121_plus_pct: number | null
          aging_mix_31_60_pct: number | null
          aging_mix_61_90_pct: number | null
          aging_mix_91_120_pct: number | null
          aging_mix_current_pct: number | null
          ai_risk_analysis: Json | null
          ai_sentiment_category: string | null
          ai_sentiment_score: number | null
          assigned_campaign_id: string | null
          auto_send_outreach: boolean | null
          avg_days_to_pay: number | null
          avg_response_sentiment: string | null
          avg_risk_score: number | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          city: string | null
          collection_health_tier: string | null
          collection_intelligence_score: number | null
          collection_score_updated_at: string | null
          collections_health_score: number | null
          collections_risk_score: number | null
          company_name: string
          country: string | null
          created_at: string | null
          credit_limit: number | null
          crm_account_id: string | null
          crm_account_id_external: string | null
          crm_system: string | null
          current_balance: number | null
          disputed_invoices_count: number | null
          email: string
          email_bounce_count: number | null
          email_status: string | null
          email_status_updated_at: string | null
          external_customer_id: string | null
          external_customer_source: string | null
          external_customer_url: string | null
          external_system: string | null
          health_tier: string | null
          high_risk_invoice_count: number | null
          id: string
          in_payment_plan_invoices_count: number | null
          inbound_email_count: number | null
          industry: string | null
          integration_source: string | null
          intelligence_report: Json | null
          intelligence_report_generated_at: string | null
          is_active: boolean | null
          is_archived: boolean | null
          last_bounce_reason: string | null
          last_outreach_date: string | null
          last_score_change_reason: string | null
          last_touchpoint_at: string | null
          latitude: number | null
          longitude: number | null
          max_days_past_due: number | null
          max_risk_score: number | null
          name: string
          next_outreach_date: string | null
          notes: string | null
          open_invoices_count: number | null
          organization_id: string | null
          outreach_frequency: string | null
          outreach_frequency_days: number | null
          outreach_paused: boolean | null
          outreach_paused_at: string | null
          outreach_paused_reason: string | null
          outreach_type: string | null
          payment_risk_tier: string | null
          payment_score: number | null
          payment_score_last_calculated: string | null
          payment_terms_default: string | null
          phone: string | null
          postal_code: string | null
          quickbooks_customer_id: string | null
          quickbooks_sync_token: string | null
          recouply_customer_id: string | null
          reference_id: string
          response_rate: number | null
          risk_last_calculated_at: string | null
          risk_status_note: string | null
          risk_tier: string | null
          risk_tier_detailed: string | null
          score_components: Json | null
          source_system: string | null
          state: string | null
          tags: Json | null
          total_open_balance: number | null
          touchpoint_count: number | null
          type: Database["public"]["Enums"]["debtor_type"] | null
          updated_at: string | null
          user_id: string
          written_off_invoices_count: number | null
        }
        Insert: {
          account_outreach_enabled?: boolean | null
          account_outreach_persona?: string | null
          account_outreach_tone?: number | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          aging_mix_1_30_pct?: number | null
          aging_mix_121_plus_pct?: number | null
          aging_mix_31_60_pct?: number | null
          aging_mix_61_90_pct?: number | null
          aging_mix_91_120_pct?: number | null
          aging_mix_current_pct?: number | null
          ai_risk_analysis?: Json | null
          ai_sentiment_category?: string | null
          ai_sentiment_score?: number | null
          assigned_campaign_id?: string | null
          auto_send_outreach?: boolean | null
          avg_days_to_pay?: number | null
          avg_response_sentiment?: string | null
          avg_risk_score?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          city?: string | null
          collection_health_tier?: string | null
          collection_intelligence_score?: number | null
          collection_score_updated_at?: string | null
          collections_health_score?: number | null
          collections_risk_score?: number | null
          company_name: string
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          crm_account_id?: string | null
          crm_account_id_external?: string | null
          crm_system?: string | null
          current_balance?: number | null
          disputed_invoices_count?: number | null
          email: string
          email_bounce_count?: number | null
          email_status?: string | null
          email_status_updated_at?: string | null
          external_customer_id?: string | null
          external_customer_source?: string | null
          external_customer_url?: string | null
          external_system?: string | null
          health_tier?: string | null
          high_risk_invoice_count?: number | null
          id?: string
          in_payment_plan_invoices_count?: number | null
          inbound_email_count?: number | null
          industry?: string | null
          integration_source?: string | null
          intelligence_report?: Json | null
          intelligence_report_generated_at?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_bounce_reason?: string | null
          last_outreach_date?: string | null
          last_score_change_reason?: string | null
          last_touchpoint_at?: string | null
          latitude?: number | null
          longitude?: number | null
          max_days_past_due?: number | null
          max_risk_score?: number | null
          name: string
          next_outreach_date?: string | null
          notes?: string | null
          open_invoices_count?: number | null
          organization_id?: string | null
          outreach_frequency?: string | null
          outreach_frequency_days?: number | null
          outreach_paused?: boolean | null
          outreach_paused_at?: string | null
          outreach_paused_reason?: string | null
          outreach_type?: string | null
          payment_risk_tier?: string | null
          payment_score?: number | null
          payment_score_last_calculated?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_sync_token?: string | null
          recouply_customer_id?: string | null
          reference_id: string
          response_rate?: number | null
          risk_last_calculated_at?: string | null
          risk_status_note?: string | null
          risk_tier?: string | null
          risk_tier_detailed?: string | null
          score_components?: Json | null
          source_system?: string | null
          state?: string | null
          tags?: Json | null
          total_open_balance?: number | null
          touchpoint_count?: number | null
          type?: Database["public"]["Enums"]["debtor_type"] | null
          updated_at?: string | null
          user_id: string
          written_off_invoices_count?: number | null
        }
        Update: {
          account_outreach_enabled?: boolean | null
          account_outreach_persona?: string | null
          account_outreach_tone?: number | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          aging_mix_1_30_pct?: number | null
          aging_mix_121_plus_pct?: number | null
          aging_mix_31_60_pct?: number | null
          aging_mix_61_90_pct?: number | null
          aging_mix_91_120_pct?: number | null
          aging_mix_current_pct?: number | null
          ai_risk_analysis?: Json | null
          ai_sentiment_category?: string | null
          ai_sentiment_score?: number | null
          assigned_campaign_id?: string | null
          auto_send_outreach?: boolean | null
          avg_days_to_pay?: number | null
          avg_response_sentiment?: string | null
          avg_risk_score?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          city?: string | null
          collection_health_tier?: string | null
          collection_intelligence_score?: number | null
          collection_score_updated_at?: string | null
          collections_health_score?: number | null
          collections_risk_score?: number | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          crm_account_id?: string | null
          crm_account_id_external?: string | null
          crm_system?: string | null
          current_balance?: number | null
          disputed_invoices_count?: number | null
          email?: string
          email_bounce_count?: number | null
          email_status?: string | null
          email_status_updated_at?: string | null
          external_customer_id?: string | null
          external_customer_source?: string | null
          external_customer_url?: string | null
          external_system?: string | null
          health_tier?: string | null
          high_risk_invoice_count?: number | null
          id?: string
          in_payment_plan_invoices_count?: number | null
          inbound_email_count?: number | null
          industry?: string | null
          integration_source?: string | null
          intelligence_report?: Json | null
          intelligence_report_generated_at?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_bounce_reason?: string | null
          last_outreach_date?: string | null
          last_score_change_reason?: string | null
          last_touchpoint_at?: string | null
          latitude?: number | null
          longitude?: number | null
          max_days_past_due?: number | null
          max_risk_score?: number | null
          name?: string
          next_outreach_date?: string | null
          notes?: string | null
          open_invoices_count?: number | null
          organization_id?: string | null
          outreach_frequency?: string | null
          outreach_frequency_days?: number | null
          outreach_paused?: boolean | null
          outreach_paused_at?: string | null
          outreach_paused_reason?: string | null
          outreach_type?: string | null
          payment_risk_tier?: string | null
          payment_score?: number | null
          payment_score_last_calculated?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_sync_token?: string | null
          recouply_customer_id?: string | null
          reference_id?: string
          response_rate?: number | null
          risk_last_calculated_at?: string | null
          risk_status_note?: string | null
          risk_tier?: string | null
          risk_tier_detailed?: string | null
          score_components?: Json | null
          source_system?: string | null
          state?: string | null
          tags?: Json | null
          total_open_balance?: number | null
          touchpoint_count?: number | null
          type?: Database["public"]["Enums"]["debtor_type"] | null
          updated_at?: string | null
          user_id?: string
          written_off_invoices_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "debtors_assigned_campaign_id_fkey"
            columns: ["assigned_campaign_id"]
            isOneToOne: false
            referencedRelation: "collection_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtors_crm_account_id_fkey"
            columns: ["crm_account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dns_verification_logs: {
        Row: {
          checked_at: string | null
          email_profile_id: string
          error_message: string | null
          id: string
          record_type: string
          verification_result: boolean | null
        }
        Insert: {
          checked_at?: string | null
          email_profile_id: string
          error_message?: string | null
          id?: string
          record_type: string
          verification_result?: boolean | null
        }
        Update: {
          checked_at?: string | null
          email_profile_id?: string
          error_message?: string | null
          id?: string
          record_type?: string
          verification_result?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dns_verification_logs_email_profile_id_fkey"
            columns: ["email_profile_id"]
            isOneToOne: false
            referencedRelation: "email_sending_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          uploaded_by_user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          uploaded_by_user_id: string
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_by_user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          debtor_id: string | null
          expires_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string | null
          public_visible: boolean | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          uploaded_by_user_id: string
          verified_at: string | null
          verified_by_user_id: string | null
          version: number
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          created_at?: string
          debtor_id?: string | null
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          public_visible?: boolean | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          uploaded_by_user_id: string
          verified_at?: string | null
          verified_by_user_id?: string | null
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          debtor_id?: string | null
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          public_visible?: boolean | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          uploaded_by_user_id?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_templates: {
        Row: {
          agent_persona_id: string | null
          aging_bucket: string
          channel: string
          created_at: string
          day_offset: number
          id: string
          message_body_template: string
          status: string
          step_number: number
          subject_template: string | null
          updated_at: string
          user_id: string
          workflow_id: string
          workflow_step_id: string
        }
        Insert: {
          agent_persona_id?: string | null
          aging_bucket: string
          channel: string
          created_at?: string
          day_offset: number
          id?: string
          message_body_template: string
          status?: string
          step_number: number
          subject_template?: string | null
          updated_at?: string
          user_id: string
          workflow_id: string
          workflow_step_id: string
        }
        Update: {
          agent_persona_id?: string | null
          aging_bucket?: string
          channel?: string
          created_at?: string
          day_offset?: number
          id?: string
          message_body_template?: string
          status?: string
          step_number?: number
          subject_template?: string | null
          updated_at?: string
          user_id?: string
          workflow_id?: string
          workflow_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_templates_agent_persona_id_fkey"
            columns: ["agent_persona_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_templates_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "collection_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_templates_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "collection_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      early_access_whitelist: {
        Row: {
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          invitee_name: string | null
          inviter_email: string | null
          inviter_name: string | null
          notes: string | null
          used_at: string | null
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          invitee_name?: string | null
          inviter_email?: string | null
          inviter_name?: string | null
          notes?: string | null
          used_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          invitee_name?: string | null
          inviter_email?: string | null
          inviter_name?: string | null
          notes?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          access_token_encrypted: string | null
          auth_method: string
          connection_status: string | null
          created_at: string
          display_name: string | null
          dkim_status: string | null
          email_address: string
          email_type: string | null
          error_message: string | null
          id: string
          imap_host: string | null
          imap_password_encrypted: string | null
          imap_port: number | null
          imap_use_tls: boolean | null
          imap_username: string | null
          is_active: boolean | null
          is_primary: boolean | null
          is_verified: boolean | null
          last_successful_send: string | null
          last_sync_at: string | null
          last_verified_at: string | null
          provider: string
          refresh_token_encrypted: string | null
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_use_tls: boolean | null
          smtp_username: string | null
          spf_status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          auth_method: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          dkim_status?: string | null
          email_address: string
          email_type?: string | null
          error_message?: string | null
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_use_tls?: boolean | null
          imap_username?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          last_successful_send?: string | null
          last_sync_at?: string | null
          last_verified_at?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_username?: string | null
          spf_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          auth_method?: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          dkim_status?: string | null
          email_address?: string
          email_type?: string | null
          error_message?: string | null
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_use_tls?: boolean | null
          imap_username?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          last_successful_send?: string | null
          last_sync_at?: string | null
          last_verified_at?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_username?: string | null
          spf_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_activity_log: {
        Row: {
          agent_name: string | null
          clicked_at: string | null
          debtor_id: string | null
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          opened_at: string | null
          organization_id: string | null
          recipient_email: string
          resend_email_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_type: string | null
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          clicked_at?: string | null
          debtor_id?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_type?: string | null
          user_id: string
        }
        Update: {
          agent_name?: string | null
          clicked_at?: string | null
          debtor_id?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_activity_log_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activity_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          audience: string
          audience_filter: Json | null
          body_html: string
          body_text: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          failed_count: number | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          template_id: string | null
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          audience?: string
          audience_filter?: Json | null
          body_html: string
          body_text?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_filter?: Json | null
          body_html?: string
          body_text?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connection_logs: {
        Row: {
          created_at: string
          email_account_id: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          email_account_id: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          email_account_id?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_connection_logs_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sending_profiles: {
        Row: {
          api_credentials_encrypted: string | null
          bounce_rate: number | null
          created_at: string | null
          dkim_record: string | null
          dkim_validated: boolean | null
          dmarc_record: string | null
          dmarc_validated: boolean | null
          domain: string
          domain_reputation: string | null
          id: string
          is_active: boolean | null
          last_verified_at: string | null
          return_path_record: string | null
          sender_email: string
          sender_name: string
          spam_complaint_rate: number | null
          spf_record: string | null
          spf_validated: boolean | null
          updated_at: string | null
          use_recouply_domain: boolean | null
          user_id: string
          verification_status: string | null
        }
        Insert: {
          api_credentials_encrypted?: string | null
          bounce_rate?: number | null
          created_at?: string | null
          dkim_record?: string | null
          dkim_validated?: boolean | null
          dmarc_record?: string | null
          dmarc_validated?: boolean | null
          domain: string
          domain_reputation?: string | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          return_path_record?: string | null
          sender_email: string
          sender_name: string
          spam_complaint_rate?: number | null
          spf_record?: string | null
          spf_validated?: boolean | null
          updated_at?: string | null
          use_recouply_domain?: boolean | null
          user_id: string
          verification_status?: string | null
        }
        Update: {
          api_credentials_encrypted?: string | null
          bounce_rate?: number | null
          created_at?: string | null
          dkim_record?: string | null
          dkim_validated?: boolean | null
          dmarc_record?: string | null
          dmarc_validated?: boolean | null
          domain?: string
          domain_reputation?: string | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          return_path_record?: string | null
          sender_email?: string
          sender_name?: string
          spam_complaint_rate?: number | null
          spf_record?: string | null
          spf_validated?: boolean | null
          updated_at?: string | null
          use_recouply_domain?: boolean | null
          user_id?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sending_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          subject_template: string
          template_key: string
          template_name: string
          updated_at: string
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          subject_template: string
          template_key: string
          template_name: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          subject_template?: string
          template_key?: string
          template_name?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email: string
          id: string
          reason: string | null
          source: string | null
          token: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          source?: string | null
          token?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          source?: string | null
          token?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
      }
      image_moderation_logs: {
        Row: {
          categories: Json | null
          created_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          image_purpose: string
          moderation_status: string
          organization_id: string | null
          rejection_reason: string | null
          storage_path: string | null
          user_id: string | null
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          image_purpose: string
          moderation_status: string
          organization_id?: string | null
          rejection_reason?: string | null
          storage_path?: string | null
          user_id?: string | null
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          image_purpose?: string
          moderation_status?: string
          organization_id?: string | null
          rejection_reason?: string | null
          storage_path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inbound_emails: {
        Row: {
          action_closed_at: string | null
          action_closed_by: string | null
          action_notes: string | null
          action_status: string | null
          ai_actions: Json | null
          ai_category: string | null
          ai_priority: string | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_sentiment_category: string | null
          ai_sentiment_score: number | null
          ai_summary: string | null
          archived_at: string | null
          archived_reason: string | null
          bcc_emails: Json | null
          cc_emails: Json | null
          created_at: string
          debtor_id: string | null
          email_id: string | null
          error_message: string | null
          event_type: string
          forwarded_at: string | null
          forwarded_to: Json | null
          from_email: string
          from_name: string | null
          html_body: string | null
          id: string
          invoice_id: string | null
          is_archived: boolean | null
          message_id: string
          raw_payload: Json
          sentiment_analyzed_at: string | null
          status: string
          subject: string
          text_body: string | null
          to_emails: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action_closed_at?: string | null
          action_closed_by?: string | null
          action_notes?: string | null
          action_status?: string | null
          ai_actions?: Json | null
          ai_category?: string | null
          ai_priority?: string | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_sentiment_category?: string | null
          ai_sentiment_score?: number | null
          ai_summary?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          bcc_emails?: Json | null
          cc_emails?: Json | null
          created_at?: string
          debtor_id?: string | null
          email_id?: string | null
          error_message?: string | null
          event_type: string
          forwarded_at?: string | null
          forwarded_to?: Json | null
          from_email: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          invoice_id?: string | null
          is_archived?: boolean | null
          message_id: string
          raw_payload: Json
          sentiment_analyzed_at?: string | null
          status?: string
          subject: string
          text_body?: string | null
          to_emails: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action_closed_at?: string | null
          action_closed_by?: string | null
          action_notes?: string | null
          action_status?: string | null
          ai_actions?: Json | null
          ai_category?: string | null
          ai_priority?: string | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_sentiment_category?: string | null
          ai_sentiment_score?: number | null
          ai_summary?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          bcc_emails?: Json | null
          cc_emails?: Json | null
          created_at?: string
          debtor_id?: string | null
          email_id?: string | null
          error_message?: string | null
          event_type?: string
          forwarded_at?: string | null
          forwarded_to?: Json | null
          from_email?: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          invoice_id?: string | null
          is_archived?: boolean | null
          message_id?: string
          raw_payload?: Json
          sentiment_analyzed_at?: string | null
          status?: string
          subject?: string
          text_body?: string | null
          to_emails?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_settings: {
        Row: {
          conflict_resolution: string | null
          created_at: string | null
          id: string
          include_draft: boolean | null
          include_open: boolean | null
          include_paid: boolean | null
          include_voided: boolean | null
          integration_type: string
          sync_credits: boolean | null
          sync_customers: boolean | null
          sync_frequency: string | null
          sync_invoices: boolean | null
          sync_payments: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conflict_resolution?: string | null
          created_at?: string | null
          id?: string
          include_draft?: boolean | null
          include_open?: boolean | null
          include_paid?: boolean | null
          include_voided?: boolean | null
          integration_type: string
          sync_credits?: boolean | null
          sync_customers?: boolean | null
          sync_frequency?: string | null
          sync_invoices?: boolean | null
          sync_payments?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conflict_resolution?: string | null
          created_at?: string | null
          id?: string
          include_draft?: boolean | null
          include_open?: boolean | null
          include_paid?: boolean | null
          include_voided?: boolean | null
          integration_type?: string
          sync_credits?: boolean | null
          sync_customers?: boolean | null
          sync_frequency?: string | null
          sync_invoices?: boolean | null
          sync_payments?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_import_errors: {
        Row: {
          error_message: string
          id: string
          import_job_id: string
          raw_row_json: Json
          row_number: number
        }
        Insert: {
          error_message: string
          id?: string
          import_job_id: string
          raw_row_json: Json
          row_number: number
        }
        Update: {
          error_message?: string
          id?: string
          import_job_id?: string
          raw_row_json?: Json
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_import_errors_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "invoice_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          error_count: number | null
          error_message: string | null
          file_name: string
          id: string
          mode: string
          status: string
          success_count: number | null
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name: string
          id?: string
          mode: string
          status?: string
          success_count?: number | null
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name?: string
          id?: string
          mode?: string
          status?: string
          success_count?: number | null
          total_rows?: number | null
        }
        Relationships: []
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
      invoice_outreach: {
        Row: {
          bucket_entered_at: string
          completed_at: string | null
          created_at: string | null
          current_bucket: string
          id: string
          invoice_id: string
          is_active: boolean | null
          paused_at: string | null
          step_1_sent_at: string | null
          step_2_sent_at: string | null
          step_3_sent_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bucket_entered_at: string
          completed_at?: string | null
          created_at?: string | null
          current_bucket: string
          id?: string
          invoice_id: string
          is_active?: boolean | null
          paused_at?: string | null
          step_1_sent_at?: string | null
          step_2_sent_at?: string | null
          step_3_sent_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bucket_entered_at?: string
          completed_at?: string | null
          created_at?: string | null
          current_bucket?: string
          id?: string
          invoice_id?: string
          is_active?: boolean | null
          paused_at?: string | null
          step_1_sent_at?: string | null
          step_2_sent_at?: string | null
          step_3_sent_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_outreach_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_override_log: {
        Row: {
          acknowledged_warning: boolean | null
          created_at: string | null
          field_name: string
          id: string
          integration_source: string | null
          invoice_id: string
          new_value: string | null
          original_value: string | null
          user_id: string
        }
        Insert: {
          acknowledged_warning?: boolean | null
          created_at?: string | null
          field_name: string
          id?: string
          integration_source?: string | null
          invoice_id: string
          new_value?: string | null
          original_value?: string | null
          user_id: string
        }
        Update: {
          acknowledged_warning?: boolean | null
          created_at?: string | null
          field_name?: string
          id?: string
          integration_source?: string | null
          invoice_id?: string
          new_value?: string | null
          original_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_override_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_update_errors: {
        Row: {
          error_message: string
          id: string
          raw_row_json: Json
          row_number: number
          status_update_job_id: string
        }
        Insert: {
          error_message: string
          id?: string
          raw_row_json: Json
          row_number: number
          status_update_job_id: string
        }
        Update: {
          error_message?: string
          id?: string
          raw_row_json?: Json
          row_number?: number
          status_update_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_update_errors_status_update_job_id_fkey"
            columns: ["status_update_job_id"]
            isOneToOne: false
            referencedRelation: "invoice_status_update_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_update_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          error_count: number | null
          error_message: string | null
          file_name: string
          id: string
          status: string
          success_count: number | null
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name: string
          id?: string
          status?: string
          success_count?: number | null
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name?: string
          id?: string
          status?: string
          success_count?: number | null
          total_rows?: number | null
        }
        Relationships: []
      }
      invoice_sync_conflicts: {
        Row: {
          conflicts: Json
          created_at: string | null
          id: string
          integration_source: string
          invoice_id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          user_id: string
        }
        Insert: {
          conflicts?: Json
          created_at?: string | null
          id?: string
          integration_source: string
          invoice_id: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id: string
        }
        Update: {
          conflicts?: Json
          created_at?: string | null
          id?: string
          integration_source?: string
          invoice_id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sync_conflicts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          created_by: string | null
          external_transaction_id: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          notes: string | null
          organization_id: string | null
          payment_method: string | null
          reason: string | null
          reference_number: string | null
          source_system: string | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          external_transaction_id?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_number?: string | null
          source_system?: string | null
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          external_transaction_id?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_number?: string | null
          source_system?: string | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          aging_bucket: string | null
          amount: number
          amount_original: number | null
          amount_outstanding: number | null
          bucket_entered_at: string | null
          created_at: string | null
          currency: string | null
          custom_template_body: string | null
          custom_template_subject: string | null
          data_center_upload_id: string | null
          debtor_id: string
          due_date: string
          external_invoice_id: string | null
          external_link: string | null
          has_local_overrides: boolean | null
          id: string
          integration_id: string | null
          integration_source: string | null
          integration_url: string | null
          invoice_number: string
          is_archived: boolean | null
          is_collectible: boolean | null
          is_overage: boolean | null
          issue_date: string
          last_contact_date: string | null
          last_contacted_at: string | null
          last_synced_at: string | null
          next_contact_date: string | null
          normalized_status: string | null
          notes: string | null
          organization_id: string | null
          original_amount: number | null
          original_due_date: string | null
          outreach_paused: boolean | null
          outreach_paused_at: string | null
          outreach_paused_reason: string | null
          override_count: number | null
          paid_date: string | null
          payment_date: string | null
          payment_method: string | null
          payment_origin: string | null
          payment_terms: string | null
          payment_terms_days: number | null
          po_number: string | null
          product_description: string | null
          promise_to_pay_amount: number | null
          promise_to_pay_date: string | null
          quickbooks_doc_number: string | null
          quickbooks_invoice_id: string | null
          reference_id: string
          source_system: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_customer_id: string | null
          stripe_hosted_url: string | null
          stripe_invoice_id: string | null
          subtotal: number | null
          tax_amount: number | null
          terminal_reason: string | null
          total_amount: number | null
          updated_at: string | null
          use_custom_template: boolean | null
          user_id: string
        }
        Insert: {
          aging_bucket?: string | null
          amount: number
          amount_original?: number | null
          amount_outstanding?: number | null
          bucket_entered_at?: string | null
          created_at?: string | null
          currency?: string | null
          custom_template_body?: string | null
          custom_template_subject?: string | null
          data_center_upload_id?: string | null
          debtor_id: string
          due_date: string
          external_invoice_id?: string | null
          external_link?: string | null
          has_local_overrides?: boolean | null
          id?: string
          integration_id?: string | null
          integration_source?: string | null
          integration_url?: string | null
          invoice_number: string
          is_archived?: boolean | null
          is_collectible?: boolean | null
          is_overage?: boolean | null
          issue_date: string
          last_contact_date?: string | null
          last_contacted_at?: string | null
          last_synced_at?: string | null
          next_contact_date?: string | null
          normalized_status?: string | null
          notes?: string | null
          organization_id?: string | null
          original_amount?: number | null
          original_due_date?: string | null
          outreach_paused?: boolean | null
          outreach_paused_at?: string | null
          outreach_paused_reason?: string | null
          override_count?: number | null
          paid_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_origin?: string | null
          payment_terms?: string | null
          payment_terms_days?: number | null
          po_number?: string | null
          product_description?: string | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          quickbooks_doc_number?: string | null
          quickbooks_invoice_id?: string | null
          reference_id: string
          source_system?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_customer_id?: string | null
          stripe_hosted_url?: string | null
          stripe_invoice_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terminal_reason?: string | null
          total_amount?: number | null
          updated_at?: string | null
          use_custom_template?: boolean | null
          user_id: string
        }
        Update: {
          aging_bucket?: string | null
          amount?: number
          amount_original?: number | null
          amount_outstanding?: number | null
          bucket_entered_at?: string | null
          created_at?: string | null
          currency?: string | null
          custom_template_body?: string | null
          custom_template_subject?: string | null
          data_center_upload_id?: string | null
          debtor_id?: string
          due_date?: string
          external_invoice_id?: string | null
          external_link?: string | null
          has_local_overrides?: boolean | null
          id?: string
          integration_id?: string | null
          integration_source?: string | null
          integration_url?: string | null
          invoice_number?: string
          is_archived?: boolean | null
          is_collectible?: boolean | null
          is_overage?: boolean | null
          issue_date?: string
          last_contact_date?: string | null
          last_contacted_at?: string | null
          last_synced_at?: string | null
          next_contact_date?: string | null
          normalized_status?: string | null
          notes?: string | null
          organization_id?: string | null
          original_amount?: number | null
          original_due_date?: string | null
          outreach_paused?: boolean | null
          outreach_paused_at?: string | null
          outreach_paused_reason?: string | null
          override_count?: number | null
          paid_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_origin?: string | null
          payment_terms?: string | null
          payment_terms_days?: number | null
          po_number?: string | null
          product_description?: string | null
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          quickbooks_doc_number?: string | null
          quickbooks_invoice_id?: string | null
          reference_id?: string
          source_system?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_customer_id?: string | null
          stripe_hosted_url?: string | null
          stripe_invoice_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terminal_reason?: string | null
          total_amount?: number | null
          updated_at?: string | null
          use_custom_template?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_data_center_upload_id_fkey"
            columns: ["data_center_upload_id"]
            isOneToOne: false
            referencedRelation: "data_center_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_campaign_progress: {
        Row: {
          assigned_at: string
          campaign_id: string
          created_at: string
          current_step: number
          id: string
          lead_id: string
          next_send_at: string | null
          status: string
          step_0_sent_at: string | null
          step_1_sent_at: string | null
          step_2_sent_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          campaign_id: string
          created_at?: string
          current_step?: number
          id?: string
          lead_id: string
          next_send_at?: string | null
          status?: string
          step_0_sent_at?: string | null
          step_1_sent_at?: string | null
          step_2_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          campaign_id?: string
          created_at?: string
          current_step?: number
          id?: string
          lead_id?: string
          next_send_at?: string | null
          status?: string
          step_0_sent_at?: string | null
          step_1_sent_at?: string | null
          step_2_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaign_progress_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_time: string | null
          email: string
          id: string
          ip_address: string
          locked_until: string | null
          success: boolean | null
        }
        Insert: {
          attempt_time?: string | null
          email: string
          id?: string
          ip_address: string
          locked_until?: string | null
          success?: boolean | null
        }
        Update: {
          attempt_time?: string | null
          email?: string
          id?: string
          ip_address?: string
          locked_until?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          campaign_type: string
          clicks: number | null
          conversions: number | null
          created_at: string
          created_by: string | null
          description: string | null
          emails_sent: number | null
          ends_at: string | null
          id: string
          min_lead_score: number | null
          name: string
          opens: number | null
          pricing_tier: string | null
          started_at: string | null
          status: string
          target_company_size: string | null
          target_industry: string | null
          target_segment: string | null
          total_leads: number | null
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emails_sent?: number | null
          ends_at?: string | null
          id?: string
          min_lead_score?: number | null
          name: string
          opens?: number | null
          pricing_tier?: string | null
          started_at?: string | null
          status?: string
          target_company_size?: string | null
          target_industry?: string | null
          target_segment?: string | null
          total_leads?: number | null
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emails_sent?: number | null
          ends_at?: string | null
          id?: string
          min_lead_score?: number | null
          name?: string
          opens?: number | null
          pricing_tier?: string | null
          started_at?: string | null
          status?: string
          target_company_size?: string | null
          target_industry?: string | null
          target_segment?: string | null
          total_leads?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_lead_activities: {
        Row: {
          activity_type: string
          broadcast_id: string | null
          campaign_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          broadcast_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          broadcast_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_lead_activities_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "email_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_lead_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          campaign_id: string | null
          company: string | null
          company_size: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          industry: string | null
          last_engaged_at: string | null
          lead_score: number | null
          lifecycle_stage: string | null
          name: string | null
          notes: string | null
          segment: string | null
          source: string | null
          status: string
          tags: string[] | null
          unsubscribe_token: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          industry?: string | null
          last_engaged_at?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          name?: string | null
          notes?: string | null
          segment?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          unsubscribe_token?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_engaged_at?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          name?: string | null
          notes?: string | null
          segment?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          unsubscribe_token?: string | null
          updated_at?: string
        }
        Relationships: []
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
      messages: {
        Row: {
          attachments: Json | null
          created_at: string
          debtor_id: string | null
          from_email: string
          html_body: string | null
          id: string
          invoice_id: string | null
          raw_body: string | null
          subject: string | null
          text_body: string | null
          to_email: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          debtor_id?: string | null
          from_email: string
          html_body?: string | null
          id?: string
          invoice_id?: string | null
          raw_body?: string | null
          subject?: string | null
          text_body?: string | null
          to_email: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          debtor_id?: string | null
          from_email?: string
          html_body?: string | null
          id?: string
          invoice_id?: string | null
          raw_body?: string | null
          subject?: string | null
          text_body?: string | null
          to_email?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_settings: {
        Row: {
          backup_codes: string[] | null
          backup_codes_encrypted: string | null
          created_at: string | null
          id: string
          mfa_enabled: boolean | null
          mfa_method: string | null
          phone_number: string | null
          totp_secret: string | null
          totp_secret_encrypted: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          backup_codes_encrypted?: string | null
          created_at?: string | null
          id?: string
          mfa_enabled?: boolean | null
          mfa_method?: string | null
          phone_number?: string | null
          totp_secret?: string | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          backup_codes_encrypted?: string | null
          created_at?: string | null
          id?: string
          mfa_enabled?: boolean | null
          mfa_method?: string | null
          phone_number?: string | null
          totp_secret?: string | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nicolas_escalations: {
        Row: {
          confidence_score: number | null
          created_at: string
          email_sent: boolean | null
          escalation_reason: string | null
          id: string
          issue_category: string | null
          organization_id: string | null
          page_route: string | null
          question: string
          slack_sent: boolean | null
          transcript_excerpt: string | null
          urgency: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          email_sent?: boolean | null
          escalation_reason?: string | null
          id?: string
          issue_category?: string | null
          organization_id?: string | null
          page_route?: string | null
          question: string
          slack_sent?: boolean | null
          transcript_excerpt?: string | null
          urgency?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          email_sent?: boolean | null
          escalation_reason?: string | null
          id?: string
          issue_category?: string | null
          organization_id?: string | null
          page_route?: string | null
          question?: string
          slack_sent?: boolean | null
          transcript_excerpt?: string | null
          urgency?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          primary_color: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          primary_color?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          primary_color?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outreach_errors: {
        Row: {
          attempted_at: string
          created_at: string
          error_message: string
          error_type: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          resolved_at: string | null
          retry_count: number | null
          step_number: number | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          error_message: string
          error_type: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          resolved_at?: string | null
          retry_count?: number | null
          step_number?: number | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          attempted_at?: string
          created_at?: string
          error_message?: string
          error_type?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          resolved_at?: string | null
          retry_count?: number | null
          step_number?: number | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_errors_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_errors_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_log: {
        Row: {
          agent_name: string
          aging_bucket: string
          body: string
          bounce_type: string | null
          bounced_at: string | null
          cadence_day: number
          delivered_at: string | null
          error_message: string | null
          id: string
          invoice_id: string
          invoice_link: string | null
          opened_at: string | null
          recipient_email: string
          resend_id: string | null
          sent_at: string | null
          status: string | null
          step_number: number
          subject: string
          user_id: string
        }
        Insert: {
          agent_name: string
          aging_bucket: string
          body: string
          bounce_type?: string | null
          bounced_at?: string | null
          cadence_day: number
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id: string
          invoice_link?: string | null
          opened_at?: string | null
          recipient_email: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          step_number: number
          subject: string
          user_id: string
        }
        Update: {
          agent_name?: string
          aging_bucket?: string
          body?: string
          bounce_type?: string | null
          bounced_at?: string | null
          cadence_day?: number
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string
          invoice_link?: string | null
          opened_at?: string | null
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          step_number?: number
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
      outreach_templates: {
        Row: {
          agent_name: string
          aging_bucket: string
          body_template: string
          cadence_day: number
          created_at: string | null
          id: string
          is_active: boolean | null
          step_number: number
          subject_template: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_name: string
          aging_bucket: string
          body_template: string
          cadence_day: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          step_number: number
          subject_template: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_name?: string
          aging_bucket?: string
          body_template?: string
          cadence_day?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          step_number?: number
          subject_template?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_invoice_links: {
        Row: {
          amount_applied: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          invoice_id: string
          match_confidence: number | null
          match_method: string
          payment_id: string
          status: string | null
        }
        Insert: {
          amount_applied: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          match_confidence?: number | null
          match_method: string
          payment_id: string
          status?: string | null
        }
        Update: {
          amount_applied?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          match_confidence?: number | null
          match_method?: string
          payment_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoice_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          data_center_upload_id: string | null
          debtor_id: string | null
          id: string
          invoice_number_hint: string | null
          notes: string | null
          organization_id: string | null
          payment_date: string
          reconciliation_status: string | null
          reference: string | null
          reference_id: string | null
          upload_batch_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          data_center_upload_id?: string | null
          debtor_id?: string | null
          id?: string
          invoice_number_hint?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date: string
          reconciliation_status?: string | null
          reference?: string | null
          reference_id?: string | null
          upload_batch_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          data_center_upload_id?: string | null
          debtor_id?: string | null
          id?: string
          invoice_number_hint?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          reconciliation_status?: string | null
          reference?: string | null
          reference_id?: string | null
          upload_batch_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_data_center_upload_id_fkey"
            columns: ["data_center_upload_id"]
            isOneToOne: false
            referencedRelation: "data_center_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_upload_batch_id_fkey"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "upload_batches"
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
          account_locked_at: string | null
          address_autocomplete_api_key: string | null
          address_autocomplete_enabled: boolean | null
          address_autocomplete_provider: string | null
          admin_override: boolean | null
          admin_override_at: string | null
          admin_override_by: string | null
          admin_override_notes: string | null
          avatar_url: string | null
          billing_interval: string | null
          business_address: string | null
          business_address_line1: string | null
          business_address_line2: string | null
          business_city: string | null
          business_country: string | null
          business_name: string | null
          business_phone: string | null
          business_postal_code: string | null
          business_state: string | null
          cancel_at_period_end: boolean | null
          company_name: string | null
          created_at: string | null
          current_period_end: string | null
          daily_digest_email_enabled: boolean | null
          email: string | null
          email_verification_token: string | null
          email_verification_token_expires_at: string | null
          email_verified: boolean | null
          id: string
          invoice_limit: number | null
          is_account_locked: boolean | null
          is_admin: boolean | null
          is_suspended: boolean | null
          name: string | null
          overage_rate: number | null
          password_hash: string | null
          payment_failure_count: number | null
          payment_failure_notice_sent_at: string | null
          phone: string | null
          plan_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          quickbooks_access_token: string | null
          quickbooks_company_name: string | null
          quickbooks_connected_at: string | null
          quickbooks_last_sync_at: string | null
          quickbooks_realm_id: string | null
          quickbooks_refresh_token: string | null
          quickbooks_sync_enabled: boolean | null
          quickbooks_token_expires_at: string | null
          sendgrid_api_key: string | null
          smtp_settings: Json | null
          stripe_customer_id: string | null
          stripe_payment_link_url: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          trial_ends_at: string | null
          trial_used_at: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_from_number: string | null
          updated_at: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          account_locked_at?: string | null
          address_autocomplete_api_key?: string | null
          address_autocomplete_enabled?: boolean | null
          address_autocomplete_provider?: string | null
          admin_override?: boolean | null
          admin_override_at?: string | null
          admin_override_by?: string | null
          admin_override_notes?: string | null
          avatar_url?: string | null
          billing_interval?: string | null
          business_address?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_city?: string | null
          business_country?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          cancel_at_period_end?: boolean | null
          company_name?: string | null
          created_at?: string | null
          current_period_end?: string | null
          daily_digest_email_enabled?: boolean | null
          email?: string | null
          email_verification_token?: string | null
          email_verification_token_expires_at?: string | null
          email_verified?: boolean | null
          id: string
          invoice_limit?: number | null
          is_account_locked?: boolean | null
          is_admin?: boolean | null
          is_suspended?: boolean | null
          name?: string | null
          overage_rate?: number | null
          password_hash?: string | null
          payment_failure_count?: number | null
          payment_failure_notice_sent_at?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          quickbooks_access_token?: string | null
          quickbooks_company_name?: string | null
          quickbooks_connected_at?: string | null
          quickbooks_last_sync_at?: string | null
          quickbooks_realm_id?: string | null
          quickbooks_refresh_token?: string | null
          quickbooks_sync_enabled?: boolean | null
          quickbooks_token_expires_at?: string | null
          sendgrid_api_key?: string | null
          smtp_settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_link_url?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          trial_ends_at?: string | null
          trial_used_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          account_locked_at?: string | null
          address_autocomplete_api_key?: string | null
          address_autocomplete_enabled?: boolean | null
          address_autocomplete_provider?: string | null
          admin_override?: boolean | null
          admin_override_at?: string | null
          admin_override_by?: string | null
          admin_override_notes?: string | null
          avatar_url?: string | null
          billing_interval?: string | null
          business_address?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_city?: string | null
          business_country?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          cancel_at_period_end?: boolean | null
          company_name?: string | null
          created_at?: string | null
          current_period_end?: string | null
          daily_digest_email_enabled?: boolean | null
          email?: string | null
          email_verification_token?: string | null
          email_verification_token_expires_at?: string | null
          email_verified?: boolean | null
          id?: string
          invoice_limit?: number | null
          is_account_locked?: boolean | null
          is_admin?: boolean | null
          is_suspended?: boolean | null
          name?: string | null
          overage_rate?: number | null
          password_hash?: string | null
          payment_failure_count?: number | null
          payment_failure_notice_sent_at?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          quickbooks_access_token?: string | null
          quickbooks_company_name?: string | null
          quickbooks_connected_at?: string | null
          quickbooks_last_sync_at?: string | null
          quickbooks_realm_id?: string | null
          quickbooks_refresh_token?: string | null
          quickbooks_sync_enabled?: boolean | null
          quickbooks_token_expires_at?: string | null
          sendgrid_api_key?: string | null
          smtp_settings?: Json | null
          stripe_customer_id?: string | null
          stripe_payment_link_url?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          trial_ends_at?: string | null
          trial_used_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
          welcome_email_sent_at?: string | null
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
      quickbooks_payments: {
        Row: {
          amount_applied: number
          created_at: string
          currency: string
          debtor_id: string | null
          id: string
          invoice_id: string | null
          payment_date: string | null
          payment_method: string | null
          quickbooks_invoice_id: string | null
          quickbooks_payment_id: string
          raw: Json | null
          reference_number: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_applied: number
          created_at?: string
          currency?: string
          debtor_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          quickbooks_invoice_id?: string | null
          quickbooks_payment_id: string
          raw?: Json | null
          reference_number?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_applied?: number
          created_at?: string
          currency?: string
          debtor_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          quickbooks_invoice_id?: string | null
          quickbooks_payment_id?: string
          raw?: Json | null
          reference_number?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_payments_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_sync_log: {
        Row: {
          completed_at: string | null
          contacts_synced: number | null
          created_at: string | null
          customers_synced: number | null
          dismissed_errors: Json | null
          errors: Json | null
          id: string
          invoices_skipped: number | null
          invoices_synced: number | null
          invoices_terminal: number | null
          needs_attention_count: number | null
          needs_attention_details: Json | null
          payments_synced: number | null
          records_failed: number | null
          records_synced: number | null
          skipped_count: number | null
          skipped_details: Json | null
          started_at: string | null
          status: string | null
          sync_type: string
          synced_count: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contacts_synced?: number | null
          created_at?: string | null
          customers_synced?: number | null
          dismissed_errors?: Json | null
          errors?: Json | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          invoices_terminal?: number | null
          needs_attention_count?: number | null
          needs_attention_details?: Json | null
          payments_synced?: number | null
          records_failed?: number | null
          records_synced?: number | null
          skipped_count?: number | null
          skipped_details?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type: string
          synced_count?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contacts_synced?: number | null
          created_at?: string | null
          customers_synced?: number | null
          dismissed_errors?: Json | null
          errors?: Json | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          invoices_terminal?: number | null
          needs_attention_count?: number | null
          needs_attention_details?: Json | null
          payments_synced?: number | null
          records_failed?: number | null
          records_synced?: number | null
          skipped_count?: number | null
          skipped_details?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          synced_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          request_count: number | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          action_type: string
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          action_type?: string
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      rca_records: {
        Row: {
          account_owner: string | null
          arr: number | null
          contract_end_date: string | null
          contract_name: string | null
          contract_start_date: string | null
          contract_status: string | null
          created_at: string
          csm_email: string | null
          csm_name: string | null
          debtor_id: string
          external_rca_id: string | null
          health_score: string | null
          id: string
          mrr: number | null
          raw_json: Json | null
          renewal_date: string | null
          risk_category: string | null
          source_system: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_owner?: string | null
          arr?: number | null
          contract_end_date?: string | null
          contract_name?: string | null
          contract_start_date?: string | null
          contract_status?: string | null
          created_at?: string
          csm_email?: string | null
          csm_name?: string | null
          debtor_id: string
          external_rca_id?: string | null
          health_score?: string | null
          id?: string
          mrr?: number | null
          raw_json?: Json | null
          renewal_date?: string | null
          risk_category?: string | null
          source_system?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_owner?: string | null
          arr?: number | null
          contract_end_date?: string | null
          contract_name?: string | null
          contract_start_date?: string | null
          contract_status?: string | null
          created_at?: string
          csm_email?: string | null
          csm_name?: string | null
          debtor_id?: string
          external_rca_id?: string | null
          health_score?: string | null
          id?: string
          mrr?: number | null
          raw_json?: Json | null
          renewal_date?: string | null
          risk_category?: string | null
          source_system?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_records_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          page_path: string
          updated_at: string
          user_id: string
          view_config: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          page_path: string
          updated_at?: string
          user_id: string
          view_config?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          page_path?: string
          updated_at?: string
          user_id?: string
          view_config?: Json
        }
        Relationships: []
      }
      score_change_logs: {
        Row: {
          change_reason: string
          change_type: string
          created_at: string | null
          debtor_id: string
          id: string
          new_health_score: number | null
          new_health_tier: string | null
          new_risk_score: number | null
          old_health_score: number | null
          old_health_tier: string | null
          old_risk_score: number | null
          score_components: Json | null
          user_id: string
        }
        Insert: {
          change_reason: string
          change_type: string
          created_at?: string | null
          debtor_id: string
          id?: string
          new_health_score?: number | null
          new_health_tier?: string | null
          new_risk_score?: number | null
          old_health_score?: number | null
          old_health_tier?: string | null
          old_risk_score?: number | null
          score_components?: Json | null
          user_id: string
        }
        Update: {
          change_reason?: string
          change_type?: string
          created_at?: string | null
          debtor_id?: string
          id?: string
          new_health_score?: number | null
          new_health_tier?: string | null
          new_risk_score?: number | null
          old_health_score?: number | null
          old_health_tier?: string | null
          old_risk_score?: number | null
          score_components?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_change_logs_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sent_template_messages: {
        Row: {
          channel: string
          created_at: string
          debtor_id: string
          delivery_status: string | null
          id: string
          invoice_id: string
          personalized_body: string
          sent_at: string
          subject: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          debtor_id: string
          delivery_status?: string | null
          id?: string
          invoice_id: string
          personalized_body: string
          sent_at?: string
          subject?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          debtor_id?: string
          delivery_status?: string | null
          id?: string
          invoice_id?: string
          personalized_body?: string
          sent_at?: string
          subject?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_template_messages_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_template_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_template_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "draft_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_score_config: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          health_score_value: number
          id: string
          risk_score_value: number
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          health_score_value?: number
          id?: string
          risk_score_value?: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          health_score_value?: number
          id?: string
          risk_score_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      smart_response_settings: {
        Row: {
          already_paid_action: string | null
          ar_portal_url: string | null
          callback_request_action: string | null
          company_address: string | null
          company_phone: string | null
          created_at: string | null
          dispute_action: string | null
          enabled: boolean | null
          general_inquiry_action: string | null
          id: string
          invoice_request_action: string | null
          organization_id: string | null
          payment_plan_request_action: string | null
          payment_question_action: string | null
          promise_to_pay_action: string | null
          response_tone: string | null
          signature_text: string | null
          updated_at: string | null
          user_id: string
          w9_document_url: string | null
          w9_request_action: string | null
        }
        Insert: {
          already_paid_action?: string | null
          ar_portal_url?: string | null
          callback_request_action?: string | null
          company_address?: string | null
          company_phone?: string | null
          created_at?: string | null
          dispute_action?: string | null
          enabled?: boolean | null
          general_inquiry_action?: string | null
          id?: string
          invoice_request_action?: string | null
          organization_id?: string | null
          payment_plan_request_action?: string | null
          payment_question_action?: string | null
          promise_to_pay_action?: string | null
          response_tone?: string | null
          signature_text?: string | null
          updated_at?: string | null
          user_id: string
          w9_document_url?: string | null
          w9_request_action?: string | null
        }
        Update: {
          already_paid_action?: string | null
          ar_portal_url?: string | null
          callback_request_action?: string | null
          company_address?: string | null
          company_phone?: string | null
          created_at?: string | null
          dispute_action?: string | null
          enabled?: boolean | null
          general_inquiry_action?: string | null
          id?: string
          invoice_request_action?: string | null
          organization_id?: string | null
          payment_plan_request_action?: string | null
          payment_question_action?: string | null
          promise_to_pay_action?: string | null
          response_tone?: string | null
          signature_text?: string | null
          updated_at?: string | null
          user_id?: string
          w9_document_url?: string | null
          w9_request_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_response_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_integrations: {
        Row: {
          auto_sync_enabled: boolean | null
          created_at: string
          id: string
          invoices_synced_count: number | null
          is_connected: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          organization_id: string | null
          stripe_account_id: string | null
          stripe_secret_key_encrypted: string | null
          sync_frequency: string | null
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          created_at?: string
          id?: string
          invoices_synced_count?: number | null
          is_connected?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          organization_id?: string | null
          stripe_account_id?: string | null
          stripe_secret_key_encrypted?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean | null
          created_at?: string
          id?: string
          invoices_synced_count?: number | null
          is_connected?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          organization_id?: string | null
          stripe_account_id?: string | null
          stripe_secret_key_encrypted?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customers_synced: number | null
          errors: Json | null
          id: string
          invoices_skipped: number | null
          invoices_synced: number | null
          invoices_terminal: number | null
          needs_attention_count: number | null
          needs_attention_details: Json | null
          paid_without_payment: number | null
          payments_synced: number | null
          records_failed: number | null
          records_synced: number | null
          skipped_count: number | null
          skipped_details: Json | null
          started_at: string | null
          status: string | null
          sync_type: string
          synced_count: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          errors?: Json | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          invoices_terminal?: number | null
          needs_attention_count?: number | null
          needs_attention_details?: Json | null
          paid_without_payment?: number | null
          payments_synced?: number | null
          records_failed?: number | null
          records_synced?: number | null
          skipped_count?: number | null
          skipped_details?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type: string
          synced_count?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          errors?: Json | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          invoices_terminal?: number | null
          needs_attention_count?: number | null
          needs_attention_details?: Json | null
          paid_without_payment?: number | null
          payments_synced?: number | null
          records_failed?: number | null
          records_synced?: number | null
          skipped_count?: number | null
          skipped_details?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          synced_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      suspicious_activity_log: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      task_responses: {
        Row: {
          body: string
          created_at: string | null
          delivery_status: string | null
          id: string
          organization_id: string | null
          original_ai_body: string | null
          resend_email_id: string | null
          sent_at: string | null
          sent_to: string
          subject: string
          task_id: string
          user_id: string
          was_edited: boolean | null
        }
        Insert: {
          body: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          organization_id?: string | null
          original_ai_body?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          sent_to: string
          subject: string
          task_id: string
          user_id: string
          was_edited?: boolean | null
        }
        Update: {
          body?: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          organization_id?: string | null
          original_ai_body?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          sent_to?: string
          subject?: string
          task_id?: string
          user_id?: string
          was_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "task_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_responses_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "collection_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upload_batches: {
        Row: {
          column_mapping: Json | null
          created_at: string
          error_count: number | null
          error_message: string | null
          file_name: string
          id: string
          processed_at: string | null
          processed_count: number | null
          processed_status: string
          row_count: number | null
          upload_type: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          error_count?: number | null
          error_message?: string | null
          file_name: string
          id?: string
          processed_at?: string | null
          processed_count?: number | null
          processed_status?: string
          row_count?: number | null
          upload_type: string
          user_id: string
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          error_count?: number | null
          error_message?: string | null
          file_name?: string
          id?: string
          processed_at?: string | null
          processed_count?: number | null
          processed_status?: string
          row_count?: number | null
          upload_type?: string
          user_id?: string
        }
        Relationships: []
      }
      upload_staging: {
        Row: {
          action: string | null
          created_at: string
          duplicate_of_id: string | null
          id: string
          mapped_data: Json | null
          raw_data: Json
          row_index: number
          upload_batch_id: string
          validation_errors: Json | null
          validation_status: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          duplicate_of_id?: string | null
          id?: string
          mapped_data?: Json | null
          raw_data: Json
          row_index: number
          upload_batch_id: string
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          duplicate_of_id?: string | null
          id?: string
          mapped_data?: Json | null
          raw_data?: Json
          row_index?: number
          upload_batch_id?: string
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_staging_upload_batch_id_fkey"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "upload_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          action_label: string | null
          action_url: string | null
          alert_type: string
          created_at: string | null
          debtor_id: string | null
          dismissed_at: string | null
          id: string
          invoice_id: string | null
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          metadata: Json | null
          organization_id: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          alert_type: string
          created_at?: string | null
          debtor_id?: string | null
          dismissed_at?: string | null
          id?: string
          invoice_id?: string | null
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          organization_id?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          alert_type?: string
          created_at?: string | null
          debtor_id?: string | null
          dismissed_at?: string | null
          id?: string
          invoice_id?: string | null
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alerts_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          read_at: string | null
          sender_id: string | null
          sender_name: string | null
          source_id: string | null
          source_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          os: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          os?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          os?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      calculate_aging_bucket: {
        Args: { due_date: string; payment_date?: string }
        Returns: string
      }
      can_access_account_data: {
        Args: { p_data_owner_id: string; p_user_id: string }
        Returns: boolean
      }
      can_access_organization: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      check_action_rate_limit: {
        Args: {
          p_action_type: string
          p_block_duration_minutes?: number
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_daily_usage: {
        Args: { p_limit?: number; p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_email: string; p_ip_address: string }
        Returns: {
          attempts_count: number
          is_locked: boolean
          locked_until: string
        }[]
      }
      clean_old_login_attempts: { Args: never; Returns: undefined }
      cleanup_dismissed_user_alerts: { Args: never; Returns: undefined }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_default_outreach_templates: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_invite_token: { Args: never; Returns: string }
      generate_reference_id: {
        Args: { prefix: string; target_table: string }
        Returns: string
      }
      get_billable_seat_count: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_effective_account_id: { Args: { p_user_id: string }; Returns: string }
      get_public_ar_page: { Args: { p_token: string }; Returns: Json }
      get_user_organization_id: { Args: { p_user_id: string }; Returns: string }
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
      is_email_blocked: { Args: { check_email: string }; Returns: boolean }
      is_email_whitelisted: { Args: { check_email: string }; Returns: boolean }
      is_recouply_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_member_of_account: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_resource_id?: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: string
      }
      log_document_access: {
        Args: { p_action: string; p_document_id: string; p_metadata?: Json }
        Returns: string
      }
      rotate_ar_page_token: { Args: { p_user_id: string }; Returns: string }
      validate_invite_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer"
      channel_type: "email" | "sms"
      debtor_type: "B2B" | "B2C"
      document_category:
        | "ACH"
        | "WIRE"
        | "W9"
        | "EIN"
        | "PROOF_OF_BUSINESS"
        | "CONTRACT"
        | "BANKING_INFO"
        | "TAX_DOCUMENT"
        | "OTHER"
      document_status:
        | "uploaded"
        | "pending_review"
        | "verified"
        | "expired"
        | "rejected"
      draft_status:
        | "pending_approval"
        | "approved"
        | "discarded"
        | "sent"
        | "skipped"
        | "cancelled"
      invoice_status:
        | "Open"
        | "Paid"
        | "Disputed"
        | "Settled"
        | "InPaymentPlan"
        | "Canceled"
        | "FinalInternalCollections"
        | "PartiallyPaid"
        | "Voided"
        | "paid"
        | "canceled"
        | "open"
        | "cancelled"
        | "voided"
        | "void"
        | "disputed"
        | "settled"
        | "inpaymentplan"
        | "partiallypaid"
        | "partially_paid"
        | "finalinternalcollections"
      outreach_log_status: "sent" | "failed" | "queued"
      outreach_status: "draft" | "scheduled" | "sent" | "failed"
      plan_type: "free" | "starter" | "growth" | "pro" | "professional"
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
      document_category: [
        "ACH",
        "WIRE",
        "W9",
        "EIN",
        "PROOF_OF_BUSINESS",
        "CONTRACT",
        "BANKING_INFO",
        "TAX_DOCUMENT",
        "OTHER",
      ],
      document_status: [
        "uploaded",
        "pending_review",
        "verified",
        "expired",
        "rejected",
      ],
      draft_status: [
        "pending_approval",
        "approved",
        "discarded",
        "sent",
        "skipped",
        "cancelled",
      ],
      invoice_status: [
        "Open",
        "Paid",
        "Disputed",
        "Settled",
        "InPaymentPlan",
        "Canceled",
        "FinalInternalCollections",
        "PartiallyPaid",
        "Voided",
        "paid",
        "canceled",
        "open",
        "cancelled",
        "voided",
        "void",
        "disputed",
        "settled",
        "inpaymentplan",
        "partiallypaid",
        "partially_paid",
        "finalinternalcollections",
      ],
      outreach_log_status: ["sent", "failed", "queued"],
      outreach_status: ["draft", "scheduled", "sent", "failed"],
      plan_type: ["free", "starter", "growth", "pro", "professional"],
      tone_type: ["friendly", "firm", "neutral"],
    },
  },
} as const
