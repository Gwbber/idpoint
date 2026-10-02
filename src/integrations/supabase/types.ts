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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          company_id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          company_id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          company_id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "asaas_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          company_id: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cakto_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cakto_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_email: string | null
          cakto_customer_id: string | null
          cakto_offer_id: string | null
          cakto_subscription_id: string | null
          cnpj: string | null
          created_at: string
          current_period_end: string | null
          custom_features: Json
          id: string
          max_employees: number
          name: string
          plan: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_email?: string | null
          cakto_customer_id?: string | null
          cakto_offer_id?: string | null
          cakto_subscription_id?: string | null
          cnpj?: string | null
          created_at?: string
          current_period_end?: string | null
          custom_features?: Json
          id?: string
          max_employees?: number
          name: string
          plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_email?: string | null
          cakto_customer_id?: string | null
          cakto_offer_id?: string | null
          cakto_subscription_id?: string | null
          cnpj?: string | null
          created_at?: string
          current_period_end?: string | null
          custom_features?: Json
          id?: string
          max_employees?: number
          name?: string
          plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          description: string
          holiday_date: string
          holiday_type: string
          id: string
          overtime_percent: number
        }
        Insert: {
          company_id?: string
          created_at?: string
          description: string
          holiday_date: string
          holiday_type?: string
          id?: string
          overtime_percent?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          holiday_date?: string
          holiday_type?: string
          id?: string
          overtime_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_id: string
          id: string
          month: number
          notes: string | null
          year: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          id?: string
          month: number
          notes?: string | null
          year: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          id?: string
          month?: number
          notes?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
          active: boolean
          company_id: string
          created_at: string
          department: string | null
          email: string
          employee_code: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_adjustments: {
        Row: {
          admin_id: string
          company_id: string
          created_at: string
          employee_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string
          time_record_id: string | null
          work_date: string
        }
        Insert: {
          admin_id: string
          company_id?: string
          created_at?: string
          employee_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason: string
          time_record_id?: string | null
          work_date: string
        }
        Update: {
          admin_id?: string
          company_id?: string
          created_at?: string
          employee_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
          time_record_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustments_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          company_id: string
          created_at: string
          id: string
          lunch_end: string | null
          lunch_start: string | null
          notes: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_working: boolean
          lunch_end: string | null
          lunch_start: string | null
          updated_at: string
          user_id: string
          weekday: number
          work_end: string | null
          work_start: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_working?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          updated_at?: string
          user_id: string
          weekday: number
          work_end?: string | null
          work_start?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_working?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          updated_at?: string
          user_id?: string
          weekday?: number
          work_end?: string | null
          work_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      company_is_active: { Args: { _company_id: string }; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_employee: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
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
      app_role: ["admin", "employee"],
    },
  },
} as const
