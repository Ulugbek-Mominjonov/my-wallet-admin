export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          archived_at: string | null
          card_last4: string | null
          color: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          household_id: string
          icon: string | null
          id: string
          name: string
          opening_balance: number
          opening_date: string
          row_version: number
          sort_order: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          card_last4?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          household_id: string
          icon?: string | null
          id?: string
          name: string
          opening_balance?: number
          opening_date: string
          row_version?: number
          sort_order?: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          card_last4?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          opening_balance?: number
          opening_date?: string
          row_version?: number
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          mime: string
          row_version: number
          size_bytes: number
          storage_path: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          mime: string
          row_version?: number
          size_bytes: number
          storage_path: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          mime?: string
          row_version?: number
          size_bytes?: number
          storage_path?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_household_id_transaction_id_fkey"
            columns: ["household_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          household_id: string | null
          id: number
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          household_id?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          household_id?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      card_message_templates: {
        Row: {
          active: boolean
          amount_unit: string
          bank: string
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          pattern: string
          sample: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_unit?: string
          bank: string
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          pattern: string
          sample?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_unit?: string
          bank?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          pattern?: string
          sample?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_message_templates_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          month_shift: number
          name: string
          parent_id: string | null
          row_version: number
          sort_order: number
          system_code:
            | Database["public"]["Enums"]["category_system_code"]
            | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          month_shift?: number
          name: string
          parent_id?: string | null
          row_version?: number
          sort_order?: number
          system_code?:
            | Database["public"]["Enums"]["category_system_code"]
            | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          month_shift?: number
          name?: string
          parent_id?: string | null
          row_version?: number
          sort_order?: number
          system_code?:
            | Database["public"]["Enums"]["category_system_code"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_household_id_parent_id_fkey"
            columns: ["household_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      category_limits: {
        Row: {
          alert_100: boolean
          alert_80: boolean
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          row_version: number
          updated_at: string
        }
        Insert: {
          alert_100?: boolean
          alert_80?: boolean
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          alert_100?: boolean
          alert_80?: boolean
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_limits_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "category_limits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      category_templates: {
        Row: {
          color: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          month_shift: number
          name_i18n: Json
          sort_order: number
          system_code:
            | Database["public"]["Enums"]["category_system_code"]
            | null
        }
        Insert: {
          color: string
          icon: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          month_shift?: number
          name_i18n: Json
          sort_order?: number
          system_code?:
            | Database["public"]["Enums"]["category_system_code"]
            | null
        }
        Update: {
          color?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          month_shift?: number
          name_i18n?: Json
          sort_order?: number
          system_code?:
            | Database["public"]["Enums"]["category_system_code"]
            | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          active: boolean
          allocation_rounding: number
          code: string
          exponent: number
          name_i18n: Json
          sort_order: number
          symbol: string
        }
        Insert: {
          active?: boolean
          allocation_rounding?: number
          code: string
          exponent?: number
          name_i18n: Json
          sort_order?: number
          symbol: string
        }
        Update: {
          active?: boolean
          allocation_rounding?: number
          code?: string
          exponent?: number
          name_i18n?: Json
          sort_order?: number
          symbol?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          household_id: string
          id: string
          monthly_payment: number | null
          name: string
          note: string | null
          paid_before: number
          row_version: number
          total: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          household_id: string
          id?: string
          monthly_payment?: number | null
          name: string
          note?: string | null
          paid_before?: number
          row_version?: number
          total: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          household_id?: string
          id?: string
          monthly_payment?: number | null
          name?: string
          note?: string | null
          paid_before?: number
          row_version?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          currency: string
          rate_date: string
          rate_to_base: number
          source: string
        }
        Insert: {
          created_at?: string
          currency: string
          rate_date: string
          rate_to_base: number
          source?: string
        }
        Update: {
          created_at?: string
          currency?: string
          rate_date?: string
          rate_to_base?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          achieved_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          deadline: string | null
          deleted_at: string | null
          household_id: string
          id: string
          monthly_contribution: number | null
          name: string
          row_version: number
          saved_manual: number
          sort_order: number
          target: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          achieved_at?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deadline?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          monthly_contribution?: number | null
          name: string
          row_version?: number
          saved_manual?: number
          sort_order?: number
          target: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          achieved_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          monthly_contribution?: number | null
          name?: string
          row_version?: number
          saved_manual?: number
          sort_order?: number
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "goals_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "goals_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          household_id: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          auto_open_month: boolean
          base_currency: string
          created_at: string
          created_by: string | null
          id: string
          last_sweep_on: string | null
          name: string
          onboarded_at: string | null
          personal_fund_day: number
          personal_fund_fixed_amount: number
          personal_fund_mode: Database["public"]["Enums"]["personal_fund_mode"]
          personal_fund_percent: number
          personal_fund_source_account_id: string | null
          purged_version: number
          row_version: number
          strict_month_lock: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_open_month?: boolean
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_sweep_on?: string | null
          name: string
          onboarded_at?: string | null
          personal_fund_day?: number
          personal_fund_fixed_amount?: number
          personal_fund_mode?: Database["public"]["Enums"]["personal_fund_mode"]
          personal_fund_percent?: number
          personal_fund_source_account_id?: string | null
          purged_version?: number
          row_version?: number
          strict_month_lock?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_open_month?: boolean
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_sweep_on?: string | null
          name?: string
          onboarded_at?: string | null
          personal_fund_day?: number
          personal_fund_fixed_amount?: number
          personal_fund_mode?: Database["public"]["Enums"]["personal_fund_mode"]
          personal_fund_percent?: number
          personal_fund_source_account_id?: string | null
          purged_version?: number
          row_version?: number
          strict_month_lock?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "households_personal_fund_source_fkey"
            columns: ["id", "personal_fund_source_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "households_personal_fund_source_fkey"
            columns: ["id", "personal_fund_source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      job_runs: {
        Row: {
          details: Json | null
          finished_at: string | null
          id: number
          job: string
          started_at: string
          status: string
        }
        Insert: {
          details?: Json | null
          finished_at?: string | null
          id?: never
          job: string
          started_at?: string
          status?: string
        }
        Update: {
          details?: Json | null
          finished_at?: string | null
          id?: never
          job?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          generated_at: string
          household_id: string
          month: string
          payload: Json
        }
        Insert: {
          generated_at?: string
          household_id: string
          month: string
          payload: Json
        }
        Update: {
          generated_at?: string
          household_id?: string
          month?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          household_id: string
          month: string
          opened_at: string | null
          row_version: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          household_id: string
          month: string
          opened_at?: string | null
          row_version?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          household_id?: string
          month?: string
          opened_at?: string | null
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "months_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string
          error: string | null
          household_id: string | null
          id: number
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          dedupe_key: string
          error?: string | null
          household_id?: string | null
          id?: never
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          dedupe_key?: string
          error?: string | null
          household_id?: string | null
          id?: never
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          big_expense: number | null
          days_ahead: number
          email: boolean
          household_id: string
          income_missing: boolean
          limit_alerts: boolean
          monthly_report: boolean
          push: boolean
          reminder_hour: number
          report_day: number
          telegram: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          big_expense?: number | null
          days_ahead?: number
          email?: boolean
          household_id: string
          income_missing?: boolean
          limit_alerts?: boolean
          monthly_report?: boolean
          push?: boolean
          reminder_hour?: number
          report_day?: number
          telegram?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          big_expense?: number | null
          days_ahead?: number
          email?: boolean
          household_id?: string
          income_missing?: boolean
          limit_alerts?: boolean
          monthly_report?: boolean
          push?: boolean
          reminder_hour?: number
          report_day?: number
          telegram?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_items: {
        Row: {
          account_id: string | null
          auto_pay: boolean
          budget_month: string
          category_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          debt_id: string | null
          deleted_at: string | null
          due_date: string
          household_id: string
          id: string
          import_batch_id: string | null
          kind: Database["public"]["Enums"]["plan_kind"]
          name: string
          note: string | null
          paid_amount: number
          planned_amount: number | null
          recurring_rule_id: string | null
          row_version: number
          settled_at: string | null
          skipped_at: string | null
          system_code: Database["public"]["Enums"]["plan_system_code"] | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          auto_pay?: boolean
          budget_month: string
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          deleted_at?: string | null
          due_date: string
          household_id: string
          id?: string
          import_batch_id?: string | null
          kind: Database["public"]["Enums"]["plan_kind"]
          name: string
          note?: string | null
          paid_amount?: number
          planned_amount?: number | null
          recurring_rule_id?: string | null
          row_version?: number
          settled_at?: string | null
          skipped_at?: string | null
          system_code?: Database["public"]["Enums"]["plan_system_code"] | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          auto_pay?: boolean
          budget_month?: string
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          deleted_at?: string | null
          due_date?: string
          household_id?: string
          id?: string
          import_batch_id?: string | null
          kind?: Database["public"]["Enums"]["plan_kind"]
          name?: string
          note?: string | null
          paid_amount?: number
          planned_amount?: number | null
          recurring_rule_id?: string | null
          row_version?: number
          settled_at?: string | null
          skipped_at?: string | null
          system_code?: Database["public"]["Enums"]["plan_system_code"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_items_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "planned_items_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "planned_items_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "planned_items_household_id_debt_id_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debt_balances"
            referencedColumns: ["household_id", "debt_id"]
          },
          {
            foreignKeyName: "planned_items_household_id_debt_id_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "planned_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_items_household_id_recurring_rule_id_fkey"
            columns: ["household_id", "recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          last_household_id: string | null
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          last_household_id?: string | null
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          last_household_id?: string | null
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_household_id_fkey"
            columns: ["last_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_actions: {
        Row: {
          account_id: string
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          name: string
          payee: string | null
          row_version: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          name: string
          payee?: string | null
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          name?: string
          payee?: string | null
          row_version?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_actions_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "quick_actions_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "quick_actions_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "quick_actions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number | null
          auto_pay: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number
          debt_id: string | null
          deleted_at: string | null
          end_month: string | null
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["plan_kind"]
          name: string
          row_version: number
          sort_order: number
          start_month: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount?: number | null
          auto_pay?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month: number
          debt_id?: string | null
          deleted_at?: string | null
          end_month?: string | null
          household_id: string
          id?: string
          kind: Database["public"]["Enums"]["plan_kind"]
          name: string
          row_version?: number
          sort_order?: number
          start_month?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number | null
          auto_pay?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          debt_id?: string | null
          deleted_at?: string | null
          end_month?: string | null
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["plan_kind"]
          name?: string
          row_version?: number
          sort_order?: number
          start_month?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_debt_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debt_balances"
            referencedColumns: ["household_id", "debt_id"]
          },
          {
            foreignKeyName: "recurring_rules_debt_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_mutations: {
        Row: {
          applied_at: string
          device_id: string
          household_id: string
          mutation_id: string
          record_id: string
          result: Json
          status: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          applied_at?: string
          device_id: string
          household_id: string
          mutation_id: string
          record_id: string
          result: Json
          status: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          applied_at?: string
          device_id?: string
          household_id?: string
          mutation_id?: string
          record_id?: string
          result?: Json
          status?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_mutations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          name: string
          row_version: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          name: string
          row_version?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          name?: string
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_tokens: {
        Row: {
          expires_at: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number
          linked_at: string
          user_id: string
        }
        Insert: {
          chat_id: number
          linked_at?: string
          user_id: string
        }
        Update: {
          chat_id?: number
          linked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_tags: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          row_version: number
          tag_id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          row_version?: number
          tag_id: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          row_version?: number
          tag_id?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_household_id_tag_id_fkey"
            columns: ["household_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transaction_tags_household_id_transaction_id_fkey"
            columns: ["household_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          amount_base: number
          budget_month: string
          budget_month_source: Database["public"]["Enums"]["budget_month_source"]
          category_id: string | null
          created_at: string
          created_by: string | null
          debt_id: string | null
          deleted_at: string | null
          fx_rate: number | null
          household_id: string
          id: string
          import_batch_id: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          note: string | null
          occurred_on: string
          payee: string | null
          planned_item_id: string | null
          row_version: number
          source: Database["public"]["Enums"]["transaction_source"]
          to_account_id: string | null
          to_amount: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          amount_base?: number
          budget_month: string
          budget_month_source?: Database["public"]["Enums"]["budget_month_source"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          deleted_at?: string | null
          fx_rate?: number | null
          household_id: string
          id?: string
          import_batch_id?: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          note?: string | null
          occurred_on: string
          payee?: string | null
          planned_item_id?: string | null
          row_version?: number
          source?: Database["public"]["Enums"]["transaction_source"]
          to_account_id?: string | null
          to_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          amount_base?: number
          budget_month?: string
          budget_month_source?: Database["public"]["Enums"]["budget_month_source"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          deleted_at?: string | null
          fx_rate?: number | null
          household_id?: string
          id?: string
          import_batch_id?: string | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          note?: string | null
          occurred_on?: string
          payee?: string | null
          planned_item_id?: string | null
          row_version?: number
          source?: Database["public"]["Enums"]["transaction_source"]
          to_account_id?: string | null
          to_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "transactions_household_id_account_id_fkey"
            columns: ["household_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_debt_id_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debt_balances"
            referencedColumns: ["household_id", "debt_id"]
          },
          {
            foreignKeyName: "transactions_household_id_debt_id_fkey"
            columns: ["household_id", "debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_planned_item_id_fkey"
            columns: ["household_id", "planned_item_id"]
            isOneToOne: false
            referencedRelation: "planned_items"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_to_account_id_fkey"
            columns: ["household_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["household_id", "account_id"]
          },
          {
            foreignKeyName: "transactions_household_id_to_account_id_fkey"
            columns: ["household_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          balance_base: number | null
          household_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_balances: {
        Row: {
          debt_id: string | null
          end_month: string | null
          household_id: string | null
          monthly_base: number | null
          months_left: number | null
          paid_in_app: number | null
          pending_amount: number | null
          pending_count: number | null
          progress: number | null
          remaining: number | null
          remaining_base: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          end_month: string | null
          goal_id: string | null
          household_id: string | null
          months_left: number | null
          on_track: boolean | null
          progress: number | null
          remaining: number | null
          saved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string }
      announcement_log: { Args: { p_limit?: number }; Returns: Json }
      app_bootstrap: { Args: never; Returns: Json }
      audit_list: {
        Args: {
          p_actors?: string[]
          p_after_at?: string
          p_after_id?: number
          p_from?: string
          p_household: string
          p_limit?: number
          p_tables?: string[]
          p_to?: string
        }
        Returns: {
          action: string
          actor_id: string
          at: string
          id: number
          new_values: Json
          old_values: Json
          record_id: string
          table_name: string
        }[]
      }
      bulk_pay_planned: {
        Args: { p_account?: string; p_date?: string; p_items: string[] }
        Returns: Json
      }
      bulk_transactions: {
        Args: {
          p_action: string
          p_household: string
          p_ids: string[]
          p_value?: string
        }
        Returns: Json
      }
      create_household: { Args: { p_name: string }; Returns: string }
      create_invite: {
        Args: {
          p_household: string
          p_role?: Database["public"]["Enums"]["member_role"]
        }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      delete_household: {
        Args: { p_confirm_name: string; p_household: string }
        Returns: undefined
      }
      export_household: { Args: { p_household: string }; Returns: Json }
      fx_backfill_dates: { Args: { p_limit?: number }; Returns: Json }
      fx_backfill_mark: { Args: { p_until: string }; Returns: undefined }
      fx_rate_for: {
        Args: { p_currency: string; p_date: string; p_household: string }
        Returns: number
      }
      fx_upsert: { Args: { p_rates: Json }; Returns: number }
      health: { Args: never; Returns: Json }
      health_check: { Args: { p_household: string }; Returns: Json }
      household_devices: { Args: { p_household: string }; Returns: Json }
      import_legacy_v1: {
        Args: { p_dry_run?: boolean; p_household: string; p_payload: Json }
        Returns: Json
      }
      import_transactions: {
        Args: { p_dry_run?: boolean; p_household: string; p_rows: Json }
        Returns: Json
      }
      leave_household: { Args: { p_household: string }; Returns: undefined }
      merge_categories: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      month_close_check: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      onboarding_apply: {
        Args: { p_household: string; p_payload: Json }
        Returns: Json
      }
      open_month: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      open_month_preview: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      outbox_claim: { Args: { p_limit?: number }; Returns: Json }
      outbox_complete: {
        Args: { p_results: Json; p_stale_tokens?: string[] }
        Returns: undefined
      }
      pay_planned: {
        Args: {
          p_account?: string
          p_amount?: number
          p_date?: string
          p_item: string
          p_settle?: boolean
        }
        Returns: Json
      }
      payee_suggestions: {
        Args: {
          p_household: string
          p_kind?: Database["public"]["Enums"]["transaction_kind"]
          p_limit?: number
          p_query: string
        }
        Returns: {
          account_id: string
          category_id: string
          last_used: string
          payee: string
        }[]
      }
      platform_health: { Args: never; Returns: Json }
      platform_set_blocked: {
        Args: { p_blocked: boolean; p_user: string }
        Returns: Json
      }
      platform_users: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: Json
      }
      prepare_account_deletion: { Args: never; Returns: Json }
      recalc_income_months_apply: {
        Args: { p_expected_count: number; p_household: string }
        Returns: Json
      }
      recalc_income_months_preview: {
        Args: { p_household: string }
        Returns: Json
      }
      recalc_income_months_rows: {
        Args: { p_household: string; p_limit?: number }
        Returns: Json
      }
      receipt_files_to_delete: {
        Args: { p_limit?: number; p_now?: string }
        Returns: string[]
      }
      register_device: {
        Args: { p_app_version?: string; p_platform: string; p_token: string }
        Returns: undefined
      }
      remove_member: {
        Args: { p_household: string; p_user: string }
        Returns: undefined
      }
      report_category_trend: {
        Args: {
          p_category?: string
          p_from: unknown
          p_household: string
          p_to: unknown
        }
        Returns: Json
      }
      report_debts: { Args: { p_household: string }; Returns: Json }
      report_goals: { Args: { p_household: string }; Returns: Json }
      report_insights: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      report_members: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      report_month: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      report_personal_fund: {
        Args: { p_from: unknown; p_household: string; p_to: unknown }
        Returns: Json
      }
      report_savings: { Args: { p_household: string }; Returns: Json }
      report_year: {
        Args: { p_household: string; p_year: number }
        Returns: Json
      }
      save_transaction: {
        Args: {
          p_account_id: string
          p_amount: number
          p_budget_month?: string
          p_category_id?: string
          p_debt_id?: string
          p_fx_rate?: number
          p_household: string
          p_id?: string
          p_kind: Database["public"]["Enums"]["transaction_kind"]
          p_note?: string
          p_occurred_on: string
          p_payee?: string
          p_planned_item_id?: string
          p_tag_ids?: string[]
          p_to_account_id?: string
          p_to_amount?: number
        }
        Returns: string
      }
      send_announcement: {
        Args: {
          p_channels?: string[]
          p_message: Json
          p_title?: Json
          p_users?: string[]
        }
        Returns: Json
      }
      send_monthly_report_now: {
        Args: { p_household: string; p_month: unknown }
        Returns: Json
      }
      set_member_role: {
        Args: {
          p_household: string
          p_role: Database["public"]["Enums"]["member_role"]
          p_user: string
        }
        Returns: undefined
      }
      set_month_closed: {
        Args: { p_closed: boolean; p_household: string; p_month: unknown }
        Returns: Json
      }
      set_sort_order: {
        Args: { p_household: string; p_ids: string[]; p_table: string }
        Returns: number
      }
      skip_planned: {
        Args: { p_item: string; p_skipped?: boolean }
        Returns: Json
      }
      sync_pull: {
        Args: { p_cursor: number; p_household: string; p_limit?: number }
        Returns: Json
      }
      sync_push: {
        Args: { p_device: string; p_household: string; p_mutations: Json }
        Returns: Json
      }
      telegram_card_templates: { Args: never; Returns: Json }
      telegram_categories: {
        Args: { p_chat_id: number; p_kind?: string; p_limit?: number }
        Returns: Json
      }
      telegram_link_consume: {
        Args: { p_chat_id: number; p_token: string }
        Returns: Json
      }
      telegram_link_token: { Args: never; Returns: Json }
      telegram_quick_add: {
        Args: {
          p_amount: number
          p_card_last4?: string
          p_chat_id: number
          p_kind: string
          p_occurred_on?: string
          p_payee?: string
        }
        Returns: Json
      }
      telegram_report: {
        Args: { p_chat_id: number; p_month?: string }
        Returns: Json
      }
      telegram_set_category: {
        Args: { p_category: string; p_chat_id: number; p_transaction: string }
        Returns: Json
      }
      telegram_set_locale: {
        Args: { p_chat_id: number; p_locale: string }
        Returns: Json
      }
      telegram_summary: { Args: { p_chat_id: number }; Returns: Json }
      telegram_undo: {
        Args: { p_chat_id: number; p_transaction: string }
        Returns: Json
      }
      telegram_unlink: { Args: never; Returns: undefined }
      telegram_unlink_chat: { Args: { p_chat_id: number }; Returns: boolean }
      test_notification: { Args: { p_household: string }; Returns: Json }
      transactions_list: {
        Args: {
          p_after_date?: string
          p_after_id?: string
          p_filters?: Json
          p_household: string
          p_limit?: number
        }
        Returns: {
          account_id: string
          amount: number
          amount_base: number
          budget_month: string
          budget_month_source: Database["public"]["Enums"]["budget_month_source"]
          category_id: string
          created_by: string
          debt_id: string
          fx_rate: number
          has_receipt: boolean
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          note: string
          occurred_on: string
          payee: string
          planned_item_id: string
          source: Database["public"]["Enums"]["transaction_source"]
          tag_ids: string[]
          to_account_id: string
          to_amount: number
        }[]
      }
      transactions_summary: {
        Args: { p_filters?: Json; p_household: string }
        Returns: Json
      }
      transfer_ownership: {
        Args: { p_household: string; p_new_owner: string }
        Returns: undefined
      }
      unregister_device: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      account_type:
        | "cash"
        | "card"
        | "bank"
        | "ewallet"
        | "deposit"
        | "personal_fund"
        | "other"
      budget_month_source: "auto" | "manual"
      category_kind: "income" | "expense"
      category_system_code: "personal_allocation"
      debt_direction: "i_owe" | "owed_to_me"
      member_role: "owner" | "admin" | "member" | "viewer"
      personal_fund_mode: "percent" | "fixed"
      plan_kind: "expense" | "income" | "allocation"
      plan_system_code: "personal_allocation"
      transaction_kind: "income" | "expense" | "transfer"
      transaction_source:
        | "manual"
        | "quick_action"
        | "auto_pay"
        | "import"
        | "telegram"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: [
        "cash",
        "card",
        "bank",
        "ewallet",
        "deposit",
        "personal_fund",
        "other",
      ],
      budget_month_source: ["auto", "manual"],
      category_kind: ["income", "expense"],
      category_system_code: ["personal_allocation"],
      debt_direction: ["i_owe", "owed_to_me"],
      member_role: ["owner", "admin", "member", "viewer"],
      personal_fund_mode: ["percent", "fixed"],
      plan_kind: ["expense", "income", "allocation"],
      plan_system_code: ["personal_allocation"],
      transaction_kind: ["income", "expense", "transfer"],
      transaction_source: [
        "manual",
        "quick_action",
        "auto_pay",
        "import",
        "telegram",
      ],
    },
  },
} as const

