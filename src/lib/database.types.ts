export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attendance: {
        Row: {
          marked_at: string
          marked_by: string | null
          player_id: string
          session_id: string
          status: Database['public']['Enums']['attendance_status']
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          player_id: string
          session_id: string
          status: Database['public']['Enums']['attendance_status']
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          player_id?: string
          session_id?: string
          status?: Database['public']['Enums']['attendance_status']
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_marked_by_fkey'
            columns: ['marked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'training_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          max_uses: number | null
          name: string
          type: Database['public']['Enums']['discount_type']
          valid_from: string | null
          valid_to: string | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_uses?: number | null
          name: string
          type: Database['public']['Enums']['discount_type']
          valid_from?: string | null
          valid_to?: string | null
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_uses?: number | null
          name?: string
          type?: Database['public']['Enums']['discount_type']
          valid_from?: string | null
          valid_to?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'discounts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          amount_fils: number
          category: Database['public']['Enums']['expense_category']
          coach_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          location_id: string | null
        }
        Insert: {
          amount_fils: number
          category: Database['public']['Enums']['expense_category']
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          location_id?: string | null
        }
        Update: {
          amount_fils?: number
          category?: Database['public']['Enums']['expense_category']
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_fils: number
          created_at: string
          id: string
          method: Database['public']['Enums']['payment_method']
          note: string | null
          paid_at: string
          received_by: string | null
          subscription_id: string
        }
        Insert: {
          amount_fils: number
          created_at?: string
          id?: string
          method?: Database['public']['Enums']['payment_method']
          note?: string | null
          paid_at?: string
          received_by?: string | null
          subscription_id: string
        }
        Update: {
          amount_fils?: number
          created_at?: string
          id?: string
          method?: Database['public']['Enums']['payment_method']
          note?: string | null
          paid_at?: string
          received_by?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_received_by_fkey'
            columns: ['received_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          id: string
          player_count: number
          price_fils: number
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          player_count: number
          price_fils: number
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          player_count?: number
          price_fils?: number
        }
        Relationships: []
      }
      player_applications: {
        Row: {
          address: string | null
          child_index: number
          cpr: string
          created_at: string
          date_of_birth: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          disease_description: string | null
          full_name: string
          guardian_name: string
          has_disease: boolean
          id: string
          language: string
          location_id: string | null
          phone: string
          player_id: string | null
          school: string | null
          status: Database['public']['Enums']['application_status']
          submission_id: string
        }
        Insert: {
          address?: string | null
          child_index: number
          cpr: string
          created_at?: string
          date_of_birth: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          disease_description?: string | null
          full_name: string
          guardian_name: string
          has_disease?: boolean
          id?: string
          language: string
          location_id?: string | null
          phone: string
          player_id?: string | null
          school?: string | null
          status?: Database['public']['Enums']['application_status']
          submission_id: string
        }
        Update: {
          address?: string | null
          child_index?: number
          cpr?: string
          created_at?: string
          date_of_birth?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          disease_description?: string | null
          full_name?: string
          guardian_name?: string
          has_disease?: boolean
          id?: string
          language?: string
          location_id?: string | null
          phone?: string
          player_id?: string | null
          school?: string | null
          status?: Database['public']['Enums']['application_status']
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'player_applications_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_applications_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_applications_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      players: {
        Row: {
          address: string | null
          coach_id: string | null
          cpr: string
          created_at: string
          created_by: string | null
          date_of_birth: string
          deleted_at: string | null
          deleted_by: string | null
          disease_description: string | null
          full_name: string
          guardian_name: string | null
          has_disease: boolean
          id: string
          location_id: string | null
          phone: string
          school: string | null
        }
        Insert: {
          address?: string | null
          coach_id?: string | null
          cpr: string
          created_at?: string
          created_by?: string | null
          date_of_birth: string
          deleted_at?: string | null
          deleted_by?: string | null
          disease_description?: string | null
          full_name: string
          guardian_name?: string | null
          has_disease?: boolean
          id?: string
          location_id?: string | null
          phone: string
          school?: string | null
        }
        Update: {
          address?: string | null
          coach_id?: string | null
          cpr?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string
          deleted_at?: string | null
          deleted_by?: string | null
          disease_description?: string | null
          full_name?: string
          guardian_name?: string | null
          has_disease?: boolean
          id?: string
          location_id?: string | null
          phone?: string
          school?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'players_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'players_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'players_deleted_by_fkey'
            columns: ['deleted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'players_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          monthly_salary_fils: number
          phone: string | null
          preferred_language: string
          role: Database['public']['Enums']['user_role']
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          monthly_salary_fils?: number
          phone?: string | null
          preferred_language?: string
          role: Database['public']['Enums']['user_role']
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          monthly_salary_fils?: number
          phone?: string | null
          preferred_language?: string
          role?: Database['public']['Enums']['user_role']
        }
        Relationships: []
      }
      settings: {
        Row: {
          expiring_soon_days: number
          id: boolean
          transport_fee_fils: number
          tshirt_fee_fils: number
        }
        Insert: {
          expiring_soon_days?: number
          id?: boolean
          transport_fee_fils?: number
          tshirt_fee_fils?: number
        }
        Update: {
          expiring_soon_days?: number
          id?: boolean
          transport_fee_fils?: number
          tshirt_fee_fils?: number
        }
        Relationships: []
      }
      subscription_players: {
        Row: {
          player_id: string
          subscription_id: string
          transport_fee_fils: number
          tshirt_fee_fils: number
        }
        Insert: {
          player_id: string
          subscription_id: string
          transport_fee_fils?: number
          tshirt_fee_fils?: number
        }
        Update: {
          player_id?: string
          subscription_id?: string
          transport_fee_fils?: number
          tshirt_fee_fils?: number
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_players_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscription_players_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          discount_fils: number
          discount_id: string | null
          discount_reason: string | null
          discount_type: Database['public']['Enums']['discount_type'] | null
          discount_value: number | null
          end_date: string
          id: string
          location_id: string | null
          plan_id: string
          plan_price_fils: number
          start_date: string
          total_fils: number
          transport_total_fils: number
          tshirt_total_fils: number
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_fils?: number
          discount_id?: string | null
          discount_reason?: string | null
          discount_type?: Database['public']['Enums']['discount_type'] | null
          discount_value?: number | null
          end_date: string
          id?: string
          location_id?: string | null
          plan_id: string
          plan_price_fils: number
          start_date: string
          total_fils: number
          transport_total_fils?: number
          tshirt_total_fils?: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_fils?: number
          discount_id?: string | null
          discount_reason?: string | null
          discount_type?: Database['public']['Enums']['discount_type'] | null
          discount_value?: number | null
          end_date?: string
          id?: string
          location_id?: string | null
          plan_id?: string
          plan_price_fils?: number
          start_date?: string
          total_fils?: number
          transport_total_fils?: number
          tshirt_total_fils?: number
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_cancelled_by_fkey'
            columns: ['cancelled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_discount_id_fkey'
            columns: ['discount_id']
            isOneToOne: false
            referencedRelation: 'discounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
      training_sessions: {
        Row: {
          cancelled_at: string | null
          coach_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          location_id: string | null
          notes: string | null
          session_date: string
          start_time: string
        }
        Insert: {
          cancelled_at?: string | null
          coach_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          location_id?: string | null
          notes?: string | null
          session_date: string
          start_time: string
        }
        Update: {
          cancelled_at?: string | null
          coach_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          session_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: 'training_sessions_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_sessions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_sessions_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      player_application_overview: {
        Row: {
          address: string | null
          child_index: number | null
          cpr: string | null
          created_at: string | null
          date_of_birth: string | null
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_note: string | null
          disease_description: string | null
          existing_player_id: string | null
          existing_player_name: string | null
          full_name: string | null
          guardian_name: string | null
          has_disease: boolean | null
          id: string | null
          language: string | null
          location_id: string | null
          location_name: string | null
          phone: string | null
          player_id: string | null
          same_cpr_pending: number | null
          school: string | null
          status: Database['public']['Enums']['application_status'] | null
          submission_id: string | null
        }
        Relationships: []
      }
      player_attendance: {
        Row: {
          coach_id: string | null
          end_time: string | null
          location_id: string | null
          location_name: string | null
          marked_at: string | null
          player_id: string | null
          session_date: string | null
          session_id: string | null
          start_time: string | null
          status: Database['public']['Enums']['attendance_status'] | null
        }
        Relationships: []
      }
      player_subscription_status: {
        Row: {
          end_date: string | null
          player_id: string | null
          start_date: string | null
          status: string | null
          subscription_id: string | null
        }
        Relationships: []
      }
      subscription_overview: {
        Row: {
          balance_fils: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          discount_fils: number | null
          discount_id: string | null
          discount_reason: string | null
          discount_type: Database['public']['Enums']['discount_type'] | null
          discount_value: number | null
          end_date: string | null
          id: string | null
          location_id: string | null
          location_name: string | null
          paid_fils: number | null
          plan_code: string | null
          plan_id: string | null
          plan_price_fils: number | null
          player_count: number | null
          player_names: string | null
          start_date: string | null
          status: string | null
          total_fils: number | null
          transport_total_fils: number | null
          tshirt_total_fils: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_player_application: {
        Args: { p_application_id: string; p_coach_id: string; p_location_id: string }
        Returns: string
      }
      assign_players: {
        Args: { p_coach_id?: string; p_player_ids: string[] }
        Returns: number
      }
      can_view_session: { Args: { p_session_id: string }; Returns: boolean }
      can_view_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      cancel_subscription: {
        Args: { p_reason: string; p_subscription_id: string }
        Returns: undefined
      }
      create_subscription: {
        Args: {
          p_discount_code?: string
          p_end_date: string
          p_initial_payment_fils?: number
          p_location_id: string
          p_manual_discount_reason?: string
          p_manual_discount_type?: Database['public']['Enums']['discount_type']
          p_manual_discount_value?: number
          p_payment_method?: Database['public']['Enums']['payment_method']
          p_payment_note?: string
          p_players: Json
          p_start_date: string
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database['public']['Enums']['user_role']
      }
      expenses_by_category: {
        Args: { p_from: string; p_location_id?: string; p_to: string }
        Returns: {
          category: Database['public']['Enums']['expense_category']
          total_fils: number
        }[]
      }
      generate_monthly_salaries: {
        Args: { p_month: string }
        Returns: {
          created_count: number
          created_fils: number
          skipped_count: number
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_summary?: Json
        }
        Returns: undefined
      }
      owns_player: { Args: { p_player_id: string }; Returns: boolean }
      record_payment: {
        Args: {
          p_amount_fils: number
          p_method?: Database['public']['Enums']['payment_method']
          p_note?: string
          p_paid_at?: string
          p_subscription_id: string
        }
        Returns: string
      }
      remove_player: { Args: { p_player_id: string }; Returns: undefined }
      public_locations: {
        Args: never
        Returns: { address: string; id: string; name: string }[]
      }
      reject_player_application: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      report_by_location: {
        Args: { p_from: string; p_to: string }
        Returns: {
          collected_fils: number
          expenses_fils: number
          location_id: string
          margin_bps: number
          profit_fils: number
        }[]
      }
      report_summary: {
        Args: { p_from: string; p_location_id?: string; p_to: string }
        Returns: {
          collected_fils: number
          expenses_fils: number
          margin_bps: number
          profit_fils: number
        }[]
      }
      revenue_by_month: {
        Args: { p_location_id?: string; p_year: number }
        Returns: {
          collected_fils: number
          expenses_fils: number
          month_start: string
          profit_fils: number
        }[]
      }
      save_attendance: {
        Args: { p_records: Json; p_session_id: string }
        Returns: undefined
      }
      set_subscription_location: {
        Args: { p_location_id: string; p_subscription_id: string }
        Returns: undefined
      }
      submit_player_applications: {
        Args: {
          p_children: Json
          p_guardian_name: string
          p_language: string
          p_location_id: string
          p_phone: string
          p_submission_id: string
          p_website?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      application_status: 'pending' | 'accepted' | 'rejected'
      attendance_status: 'present' | 'absent'
      discount_type: 'percent' | 'fixed'
      expense_category: 'coach_salary' | 'field_rent' | 'transportation' | 'equipment' | 'other'
      payment_method: 'cash' | 'benefit' | 'bank_transfer' | 'other'
      user_role: 'admin' | 'coach'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: ['pending', 'accepted', 'rejected'],
      attendance_status: ['present', 'absent'],
      discount_type: ['percent', 'fixed'],
      expense_category: ['coach_salary', 'field_rent', 'transportation', 'equipment', 'other'],
      payment_method: ['cash', 'benefit', 'bank_transfer', 'other'],
      user_role: ['admin', 'coach'],
    },
  },
} as const
