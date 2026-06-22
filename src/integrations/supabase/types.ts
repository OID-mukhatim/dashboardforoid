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
      document_extractions: {
        Row: {
          created_at: string
          entities: Json | null
          file_name: string
          file_path: string
          id: string
          numbers_found: Json | null
          org_mentions: Json | null
          summary: string | null
          text_preview: string | null
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          entities?: Json | null
          file_name: string
          file_path: string
          id?: string
          numbers_found?: Json | null
          org_mentions?: Json | null
          summary?: string | null
          text_preview?: string | null
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          entities?: Json | null
          file_name?: string
          file_path?: string
          id?: string
          numbers_found?: Json | null
          org_mentions?: Json | null
          summary?: string | null
          text_preview?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      initiatives: {
        Row: {
          code: string | null
          cost: string | null
          created_at: string
          created_by: string | null
          domain: string | null
          gap: string | null
          id: string
          notes: string | null
          objective: string | null
          orgs: string[]
          priority: string
          source: string
          status: string
          timeline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          cost?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          gap?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          orgs?: string[]
          priority?: string
          source?: string
          status?: string
          timeline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          cost?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          gap?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          orgs?: string[]
          priority?: string
          source?: string
          status?: string
          timeline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpis: {
        Row: {
          achievement_pct: number | null
          annual_target: number | null
          baseline: number | null
          created_at: string
          entity_code: string
          entity_name: string | null
          final_output: string | null
          id: string
          kpi_code: string
          kpi_name: string | null
          kpi_type: string | null
          objective: string | null
          overall_pct: number | null
          period: string
          q1_actual: number | null
          q1_planned: number | null
          q2_actual: number | null
          q2_planned: number | null
          q3_actual: number | null
          q3_planned: number | null
          q4_actual: number | null
          q4_planned: number | null
          raw: Json | null
          sector: string | null
          total_actual: number | null
          total_planned: number | null
          updated_at: string
          upload_id: string | null
          weight: number | null
        }
        Insert: {
          achievement_pct?: number | null
          annual_target?: number | null
          baseline?: number | null
          created_at?: string
          entity_code: string
          entity_name?: string | null
          final_output?: string | null
          id?: string
          kpi_code: string
          kpi_name?: string | null
          kpi_type?: string | null
          objective?: string | null
          overall_pct?: number | null
          period?: string
          q1_actual?: number | null
          q1_planned?: number | null
          q2_actual?: number | null
          q2_planned?: number | null
          q3_actual?: number | null
          q3_planned?: number | null
          q4_actual?: number | null
          q4_planned?: number | null
          raw?: Json | null
          sector?: string | null
          total_actual?: number | null
          total_planned?: number | null
          updated_at?: string
          upload_id?: string | null
          weight?: number | null
        }
        Update: {
          achievement_pct?: number | null
          annual_target?: number | null
          baseline?: number | null
          created_at?: string
          entity_code?: string
          entity_name?: string | null
          final_output?: string | null
          id?: string
          kpi_code?: string
          kpi_name?: string | null
          kpi_type?: string | null
          objective?: string | null
          overall_pct?: number | null
          period?: string
          q1_actual?: number | null
          q1_planned?: number | null
          q2_actual?: number | null
          q2_planned?: number | null
          q3_actual?: number | null
          q3_planned?: number | null
          q4_actual?: number | null
          q4_planned?: number | null
          raw?: Json | null
          sector?: string | null
          total_actual?: number | null
          total_planned?: number | null
          updated_at?: string
          upload_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          data_type: string
          error_message: string | null
          extracted_summary: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          org_id: string
          period: string
          rows_extracted: number | null
          status: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          data_type?: string
          error_message?: string | null
          extracted_summary?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          org_id?: string
          period?: string
          rows_extracted?: number | null
          status?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          data_type?: string
          error_message?: string | null
          extracted_summary?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          org_id?: string
          period?: string
          rows_extracted?: number | null
          status?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "developer" | "viewer"
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
      app_role: ["admin", "developer", "viewer"],
    },
  },
} as const
