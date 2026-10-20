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
      advisor_snapshots: {
        Row: {
          assessment: Json | null
          created_at: string
          done: boolean
          id: string
          period: string
          period_order: number
          program: Json | null
          source_upload_id: string | null
          timeline_title: string
          updated_at: string
        }
        Insert: {
          assessment?: Json | null
          created_at?: string
          done?: boolean
          id?: string
          period: string
          period_order: number
          program?: Json | null
          source_upload_id?: string | null
          timeline_title: string
          updated_at?: string
        }
        Update: {
          assessment?: Json | null
          created_at?: string
          done?: boolean
          id?: string
          period?: string
          period_order?: number
          program?: Json | null
          source_upload_id?: string | null
          timeline_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_snapshots_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: true
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: string
          new_data: Json | null
          old_data: Json | null
          org_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          created_at: string
          entities: Json | null
          entity_code: string | null
          file_name: string
          file_path: string
          fiscal_year_type: string
          id: string
          kind: string
          numbers_found: Json | null
          org_mentions: Json | null
          payload: Json | null
          summary: string | null
          text_preview: string | null
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          entities?: Json | null
          entity_code?: string | null
          file_name: string
          file_path: string
          fiscal_year_type?: string
          id?: string
          kind?: string
          numbers_found?: Json | null
          org_mentions?: Json | null
          payload?: Json | null
          summary?: string | null
          text_preview?: string | null
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          entities?: Json | null
          entity_code?: string | null
          file_name?: string
          file_path?: string
          fiscal_year_type?: string
          id?: string
          kind?: string
          numbers_found?: Json | null
          org_mentions?: Json | null
          payload?: Json | null
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
      financial_reports: {
        Row: {
          actions: string | null
          actual_spending: number | null
          approved_budget: number | null
          challenges: string | null
          created_at: string
          created_by: string | null
          expenses: Json | null
          fiscal_type: string | null
          id: string
          notes: string | null
          org_id: string
          plan_year: number
          quarter: string
          revenues: Json | null
          status: string
          surplus_deficit: number | null
          updated_at: string
        }
        Insert: {
          actions?: string | null
          actual_spending?: number | null
          approved_budget?: number | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          expenses?: Json | null
          fiscal_type?: string | null
          id?: string
          notes?: string | null
          org_id: string
          plan_year?: number
          quarter: string
          revenues?: Json | null
          status?: string
          surplus_deficit?: number | null
          updated_at?: string
        }
        Update: {
          actions?: string | null
          actual_spending?: number | null
          approved_budget?: number | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          expenses?: Json | null
          fiscal_type?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          plan_year?: number
          quarter?: string
          revenues?: Json | null
          status?: string
          surplus_deficit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      gap_scores: {
        Row: {
          created_at: string
          domain_index: number
          domain_name: string
          id: string
          note: string | null
          org_id: string
          period: string
          score: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          domain_index: number
          domain_name: string
          id?: string
          note?: string | null
          org_id: string
          period?: string
          score: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          domain_index?: number
          domain_name?: string
          id?: string
          note?: string | null
          org_id?: string
          period?: string
          score?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      governance_policies: {
        Row: {
          created_at: string
          id: string
          note: string | null
          org_id: string
          policy_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          org_id: string
          policy_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          org_id?: string
          policy_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          org_ids: string[]
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
          org_ids?: string[]
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
          org_ids?: string[]
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
      institutions: {
        Row: {
          address: string | null
          branches: string | null
          budget: number | null
          deputy_email: string | null
          deputy_name_ar: string | null
          deputy_phone: string | null
          excellence: string | null
          exec_email: string | null
          exec_name_ar: string | null
          exec_phone: string | null
          founded: string | null
          id: string
          license_expiry: string | null
          license_number: string | null
          logo_url: string | null
          name_ar: string
          name_en: string | null
          sector: string | null
          staff_female: number | null
          staff_male: number | null
          staff_total: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          branches?: string | null
          budget?: number | null
          deputy_email?: string | null
          deputy_name_ar?: string | null
          deputy_phone?: string | null
          excellence?: string | null
          exec_email?: string | null
          exec_name_ar?: string | null
          exec_phone?: string | null
          founded?: string | null
          id: string
          license_expiry?: string | null
          license_number?: string | null
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          sector?: string | null
          staff_female?: number | null
          staff_male?: number | null
          staff_total?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          branches?: string | null
          budget?: number | null
          deputy_email?: string | null
          deputy_name_ar?: string | null
          deputy_phone?: string | null
          excellence?: string | null
          exec_email?: string | null
          exec_name_ar?: string | null
          exec_phone?: string | null
          founded?: string | null
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          sector?: string | null
          staff_female?: number | null
          staff_male?: number | null
          staff_total?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      kpi_goals: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          perspective_id: string
          plan_year: number
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          perspective_id: string
          plan_year: number
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          perspective_id?: string
          plan_year?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_goals_perspective_id_fkey"
            columns: ["perspective_id"]
            isOneToOne: false
            referencedRelation: "kpi_perspectives"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_perspectives: {
        Row: {
          created_at: string
          id: string
          name: string
          name_en: string | null
          org_id: string
          plan_year: number
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          org_id: string
          plan_year: number
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          org_id?: string
          plan_year?: number
          weight?: number
        }
        Relationships: []
      }
      kpis: {
        Row: {
          achievement_pct: number | null
          annual_target: number | null
          baseline: number | null
          calculation: string | null
          card_completed: boolean
          created_at: string
          data_sources: string | null
          department: string | null
          description: string | null
          enablers: string | null
          entity_code: string
          entity_name: string | null
          final_output: string | null
          fiscal_type: string | null
          fiscal_year_type: string
          frequency: string | null
          goal_id: string | null
          id: string
          indicator_role: string | null
          indicator_type: string | null
          input_lang: string | null
          is_baseline: boolean | null
          kpi_code: string
          kpi_name: string | null
          kpi_type: string | null
          measurement_nature: string | null
          objective: string | null
          overall_pct: number | null
          period: string
          plan_year: number | null
          polarity: string | null
          q1_actual: number | null
          q1_planned: number | null
          q2_actual: number | null
          q2_planned: number | null
          q3_actual: number | null
          q3_planned: number | null
          q4_actual: number | null
          q4_planned: number | null
          raw: Json | null
          related_goal: string | null
          related_kpis: string | null
          sector: string | null
          threshold_green: string | null
          threshold_red: string | null
          threshold_yellow: string | null
          total_actual: number | null
          total_planned: number | null
          unit: string | null
          updated_at: string
          upload_id: string | null
          weight: number | null
        }
        Insert: {
          achievement_pct?: number | null
          annual_target?: number | null
          baseline?: number | null
          calculation?: string | null
          card_completed?: boolean
          created_at?: string
          data_sources?: string | null
          department?: string | null
          description?: string | null
          enablers?: string | null
          entity_code: string
          entity_name?: string | null
          final_output?: string | null
          fiscal_type?: string | null
          fiscal_year_type?: string
          frequency?: string | null
          goal_id?: string | null
          id?: string
          indicator_role?: string | null
          indicator_type?: string | null
          input_lang?: string | null
          is_baseline?: boolean | null
          kpi_code: string
          kpi_name?: string | null
          kpi_type?: string | null
          measurement_nature?: string | null
          objective?: string | null
          overall_pct?: number | null
          period?: string
          plan_year?: number | null
          polarity?: string | null
          q1_actual?: number | null
          q1_planned?: number | null
          q2_actual?: number | null
          q2_planned?: number | null
          q3_actual?: number | null
          q3_planned?: number | null
          q4_actual?: number | null
          q4_planned?: number | null
          raw?: Json | null
          related_goal?: string | null
          related_kpis?: string | null
          sector?: string | null
          threshold_green?: string | null
          threshold_red?: string | null
          threshold_yellow?: string | null
          total_actual?: number | null
          total_planned?: number | null
          unit?: string | null
          updated_at?: string
          upload_id?: string | null
          weight?: number | null
        }
        Update: {
          achievement_pct?: number | null
          annual_target?: number | null
          baseline?: number | null
          calculation?: string | null
          card_completed?: boolean
          created_at?: string
          data_sources?: string | null
          department?: string | null
          description?: string | null
          enablers?: string | null
          entity_code?: string
          entity_name?: string | null
          final_output?: string | null
          fiscal_type?: string | null
          fiscal_year_type?: string
          frequency?: string | null
          goal_id?: string | null
          id?: string
          indicator_role?: string | null
          indicator_type?: string | null
          input_lang?: string | null
          is_baseline?: boolean | null
          kpi_code?: string
          kpi_name?: string | null
          kpi_type?: string | null
          measurement_nature?: string | null
          objective?: string | null
          overall_pct?: number | null
          period?: string
          plan_year?: number | null
          polarity?: string | null
          q1_actual?: number | null
          q1_planned?: number | null
          q2_actual?: number | null
          q2_planned?: number | null
          q3_actual?: number | null
          q3_planned?: number | null
          q4_actual?: number | null
          q4_planned?: number | null
          raw?: Json | null
          related_goal?: string | null
          related_kpis?: string | null
          sector?: string | null
          threshold_green?: string | null
          threshold_red?: string | null
          threshold_yellow?: string | null
          total_actual?: number | null
          total_planned?: number | null
          unit?: string | null
          updated_at?: string
          upload_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "kpi_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_decisions: {
        Row: {
          assigned_to: string | null
          converted: boolean
          created_at: string
          decision: string
          due_date: string | null
          id: string
          meeting_id: string
          task_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          converted?: boolean
          created_at?: string
          decision: string
          due_date?: string | null
          id?: string
          meeting_id: string
          task_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          converted?: boolean
          created_at?: string
          decision?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "office_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendees: Json
          created_at: string
          created_by: string | null
          date: string
          duration: string | null
          id: string
          location: string | null
          meeting_type: string
          minutes: string | null
          objective: string | null
          org_id: string | null
          outputs: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendees?: Json
          created_at?: string
          created_by?: string | null
          date: string
          duration?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          minutes?: string | null
          objective?: string | null
          org_id?: string | null
          outputs?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendees?: Json
          created_at?: string
          created_by?: string | null
          date?: string
          duration?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          minutes?: string | null
          objective?: string | null
          org_id?: string | null
          outputs?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      office_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          objective: string | null
          quarter: string | null
          status: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          objective?: string | null
          quarter?: string | null
          status?: string
          title: string
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          objective?: string | null
          quarter?: string | null
          status?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      office_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          org_id: string | null
          priority: string
          section_ref: string | null
          source_ref: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          section_ref?: string | null
          source_ref?: string | null
          source_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          section_ref?: string | null
          source_ref?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_active_years: {
        Row: {
          active_year: number
          fiscal_type: string
          org_id: string
          updated_at: string
        }
        Insert: {
          active_year: number
          fiscal_type?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          active_year?: number
          fiscal_type?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          abbr: string
          aliases: string[]
          color: string
          created_at: string
          fiscal_type: string
          id: string
          name_ar: string
          name_en: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          abbr?: string
          aliases?: string[]
          color?: string
          created_at?: string
          fiscal_type?: string
          id: string
          name_ar: string
          name_en?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          abbr?: string
          aliases?: string[]
          color?: string
          created_at?: string
          fiscal_type?: string
          id?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      partnerships: {
        Row: {
          contact: string | null
          created_at: string
          description: string | null
          end_date: string | null
          geography: string | null
          id: string
          linked_orgs: string[]
          name: string
          name_en: string | null
          notes: string | null
          outcomes: string[] | null
          start_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          geography?: string | null
          id?: string
          linked_orgs?: string[]
          name: string
          name_en?: string | null
          notes?: string | null
          outcomes?: string[] | null
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          geography?: string | null
          id?: string
          linked_orgs?: string[]
          name?: string
          name_en?: string | null
          notes?: string | null
          outcomes?: string[] | null
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      perf_activities: {
        Row: {
          achieved: number | null
          activity_type: string
          beneficiaries: number | null
          id: string
          implementer: string | null
          kpi_code: string | null
          kpi_id: string | null
          notes: string | null
          plan_id: string
          planned: number | null
          quarter: string
          target_group: string | null
          title: string
        }
        Insert: {
          achieved?: number | null
          activity_type: string
          beneficiaries?: number | null
          id?: string
          implementer?: string | null
          kpi_code?: string | null
          kpi_id?: string | null
          notes?: string | null
          plan_id: string
          planned?: number | null
          quarter: string
          target_group?: string | null
          title: string
        }
        Update: {
          achieved?: number | null
          activity_type?: string
          beneficiaries?: number | null
          id?: string
          implementer?: string | null
          kpi_code?: string | null
          kpi_id?: string | null
          notes?: string | null
          plan_id?: string
          planned?: number | null
          quarter?: string
          target_group?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_activities_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "perf_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_activities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "perf_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_corrections: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          period: string
          plan_id: string
          reason: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          period: string
          plan_id: string
          reason: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          period?: string
          plan_id?: string
          reason?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_corrections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "perf_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_kpis: {
        Row: {
          annual_target: number | null
          baseline: number | null
          calc_formula_approved_at: string | null
          calc_formula_approved_by: string | null
          calc_formula_status: string
          calc_method: string
          calculation_formula: string | null
          code: string
          data_sources: string | null
          department: string | null
          description: string | null
          enablers: string | null
          id: string
          measurement: string
          name: string
          notes: string | null
          objective: string
          perspective: string
          plan_id: string
          polarity: string
          q1_actual: number | null
          q1_plan: number | null
          q2_actual: number | null
          q2_plan: number | null
          q3_actual: number | null
          q3_plan: number | null
          q4_actual: number | null
          q4_plan: number | null
          related_kpis: string | null
          role: string
          seq: number
          unit: string
          weight: number
        }
        Insert: {
          annual_target?: number | null
          baseline?: number | null
          calc_formula_approved_at?: string | null
          calc_formula_approved_by?: string | null
          calc_formula_status?: string
          calc_method: string
          calculation_formula?: string | null
          code: string
          data_sources?: string | null
          department?: string | null
          description?: string | null
          enablers?: string | null
          id?: string
          measurement: string
          name: string
          notes?: string | null
          objective?: string
          perspective: string
          plan_id: string
          polarity: string
          q1_actual?: number | null
          q1_plan?: number | null
          q2_actual?: number | null
          q2_plan?: number | null
          q3_actual?: number | null
          q3_plan?: number | null
          q4_actual?: number | null
          q4_plan?: number | null
          related_kpis?: string | null
          role: string
          seq: number
          unit: string
          weight: number
        }
        Update: {
          annual_target?: number | null
          baseline?: number | null
          calc_formula_approved_at?: string | null
          calc_formula_approved_by?: string | null
          calc_formula_status?: string
          calc_method?: string
          calculation_formula?: string | null
          code?: string
          data_sources?: string | null
          department?: string | null
          description?: string | null
          enablers?: string | null
          id?: string
          measurement?: string
          name?: string
          notes?: string | null
          objective?: string
          perspective?: string
          plan_id?: string
          polarity?: string
          q1_actual?: number | null
          q1_plan?: number | null
          q2_actual?: number | null
          q2_plan?: number | null
          q3_actual?: number | null
          q3_plan?: number | null
          q4_actual?: number | null
          q4_plan?: number | null
          related_kpis?: string | null
          role?: string
          seq?: number
          unit?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "perf_kpis_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "perf_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_plan_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string
          id: string
          plan_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status: string
          id?: string
          plan_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string
          id?: string
          plan_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_plan_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "perf_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_plans: {
        Row: {
          approved_by: string | null
          created_at: string
          fiscal_type: string
          id: string
          matrix_approved_at: string | null
          matrix_approved_by: string | null
          objectives_approved_at: string | null
          objectives_approved_by: string | null
          org_id: string
          plan_year: number
          prepared_by: string | null
          source_upload_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          fiscal_type: string
          id?: string
          matrix_approved_at?: string | null
          matrix_approved_by?: string | null
          objectives_approved_at?: string | null
          objectives_approved_by?: string | null
          org_id: string
          plan_year: number
          prepared_by?: string | null
          source_upload_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          fiscal_type?: string
          id?: string
          matrix_approved_at?: string | null
          matrix_approved_by?: string | null
          objectives_approved_at?: string | null
          objectives_approved_by?: string | null
          org_id?: string
          plan_year?: number
          prepared_by?: string | null
          source_upload_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_plans_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_report_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string
          id: string
          previous_snapshot: Json | null
          reason: string | null
          report_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status: string
          id?: string
          previous_snapshot?: Json | null
          reason?: string | null
          report_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string
          id?: string
          previous_snapshot?: Json | null
          reason?: string | null
          report_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "perf_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_reports: {
        Row: {
          achievements: Json
          annual_stats: Json
          approved_at: string | null
          approved_by: string | null
          challenges: Json
          executive_summary: string | null
          id: string
          period: string
          plan_id: string
          planned_beneficiaries: number | null
          proposals: Json
          snapshot: Json | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          achievements?: Json
          annual_stats?: Json
          approved_at?: string | null
          approved_by?: string | null
          challenges?: Json
          executive_summary?: string | null
          id?: string
          period: string
          plan_id: string
          planned_beneficiaries?: number | null
          proposals?: Json
          snapshot?: Json | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          achievements?: Json
          annual_stats?: Json
          approved_at?: string | null
          approved_by?: string | null
          challenges?: Json
          executive_summary?: string | null
          id?: string
          period?: string
          plan_id?: string
          planned_beneficiaries?: number | null
          proposals?: Json
          snapshot?: Json | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perf_reports_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "perf_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_activities: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          plan_id: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          plan_id: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          plan_id?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_activities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "office_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "office_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_reports: {
        Row: {
          achieved: string | null
          beneficiaries: string | null
          created_at: string
          fiscal_year_type: string
          id: string
          is_baseline: boolean | null
          kpi_code: string | null
          org_id: string
          pct: number | null
          plan_year: number | null
          quarter: string
          raw: Json | null
          report_type: string | null
          status: string | null
          target: string | null
          title: string
          updated_at: string
          upload_id: string | null
          year: number
        }
        Insert: {
          achieved?: string | null
          beneficiaries?: string | null
          created_at?: string
          fiscal_year_type?: string
          id?: string
          is_baseline?: boolean | null
          kpi_code?: string | null
          org_id: string
          pct?: number | null
          plan_year?: number | null
          quarter?: string
          raw?: Json | null
          report_type?: string | null
          status?: string | null
          target?: string | null
          title: string
          updated_at?: string
          upload_id?: string | null
          year?: number
        }
        Update: {
          achieved?: string | null
          beneficiaries?: string | null
          created_at?: string
          fiscal_year_type?: string
          id?: string
          is_baseline?: boolean | null
          kpi_code?: string | null
          org_id?: string
          pct?: number | null
          plan_year?: number | null
          quarter?: string
          raw?: Json | null
          report_type?: string | null
          status?: string | null
          target?: string | null
          title?: string
          updated_at?: string
          upload_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_reports_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      section_order: {
        Row: {
          id: string
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terminology: {
        Row: {
          ar: string
          category: string
          created_at: string
          en: string
          id: string
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ar: string
          category?: string
          created_at?: string
          en: string
          id?: string
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ar?: string
          category?: string
          created_at?: string
          en?: string
          id?: string
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      timeline_entries: {
        Row: {
          domain: string
          fiscal_year_type: string
          id: string
          note: string | null
          org_id: string
          period: string
          period_order: number
          recorded_at: string | null
          value: number
        }
        Insert: {
          domain: string
          fiscal_year_type?: string
          id?: string
          note?: string | null
          org_id: string
          period: string
          period_order: number
          recorded_at?: string | null
          value: number
        }
        Update: {
          domain?: string
          fiscal_year_type?: string
          id?: string
          note?: string | null
          org_id?: string
          period?: string
          period_order?: number
          recorded_at?: string | null
          value?: number
        }
        Relationships: []
      }
      translations_cache: {
        Row: {
          created_at: string
          field_name: string | null
          id: string
          record_id: string | null
          source_lang: string
          source_text: string
          table_name: string | null
          target_lang: string
          translated: string
        }
        Insert: {
          created_at?: string
          field_name?: string | null
          id?: string
          record_id?: string | null
          source_lang: string
          source_text: string
          table_name?: string | null
          target_lang: string
          translated: string
        }
        Update: {
          created_at?: string
          field_name?: string | null
          id?: string
          record_id?: string | null
          source_lang?: string
          source_text?: string
          table_name?: string | null
          target_lang?: string
          translated?: string
        }
        Relationships: []
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
          progress: Json | null
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
          progress?: Json | null
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
          progress?: Json | null
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
          preferred_lang: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_lang?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_lang?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_gaps: {
        Row: {
          action: string | null
          converted: boolean
          created_at: string
          due_date: string | null
          gap: string
          id: string
          priority: string
          task_id: string | null
          visit_id: string
        }
        Insert: {
          action?: string | null
          converted?: boolean
          created_at?: string
          due_date?: string | null
          gap: string
          id?: string
          priority?: string
          task_id?: string | null
          visit_id: string
        }
        Update: {
          action?: string | null
          converted?: boolean
          created_at?: string
          due_date?: string | null
          gap?: string
          id?: string
          priority?: string
          task_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_gaps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "office_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_gaps_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          best_practices: string | null
          challenges: string | null
          created_at: string
          created_by: string | null
          date: string
          discipline: string | null
          general_work: string | null
          guidance: string | null
          id: string
          notes: string | null
          objective: string | null
          oid_delegate: string | null
          org_delegate: string | null
          org_id: string
          outputs: string | null
          performance: string
          prev_followups: string | null
          readiness: string | null
          status: string
          updated_at: string
          visit_type: string
          visual_identity: string | null
        }
        Insert: {
          best_practices?: string | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          discipline?: string | null
          general_work?: string | null
          guidance?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          oid_delegate?: string | null
          org_delegate?: string | null
          org_id: string
          outputs?: string | null
          performance?: string
          prev_followups?: string | null
          readiness?: string | null
          status?: string
          updated_at?: string
          visit_type?: string
          visual_identity?: string | null
        }
        Update: {
          best_practices?: string | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          discipline?: string | null
          general_work?: string | null
          guidance?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          oid_delegate?: string | null
          org_delegate?: string | null
          org_id?: string
          outputs?: string | null
          performance?: string
          prev_followups?: string | null
          readiness?: string | null
          status?: string
          updated_at?: string
          visit_type?: string
          visual_identity?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_perf_report: {
        Args: { p_period: string; p_plan: string; p_snapshot: Json }
        Returns: string
      }
      commit_perf_import: {
        Args: {
          p_allow_definitions: boolean
          p_org: string
          p_payload: Json
          p_revision: string
          p_upload: string
          p_year: number
        }
        Returns: string
      }
      mutate_perf_kpis: {
        Args: { p_plan: string; p_revision: string; p_rows: Json }
        Returns: Json
      }
      perf_correct: {
        Args: {
          p_field: string
          p_period: string
          p_plan: string
          p_reason: string
          p_record: string
          p_table: string
          p_value: Json
        }
        Returns: string
      }
      perf_quarter_locked: {
        Args: { p_plan: string; p_quarter: string }
        Returns: boolean
      }
      reopen_perf_report: {
        Args: { p_reason: string; p_report: string }
        Returns: undefined
      }
      reorder_perf_kpis: {
        Args: { p_ids: string[]; p_plan: string }
        Returns: undefined
      }
      save_perf_actuals: {
        Args: { p_plan: string; p_quarter: number; p_rows: Json }
        Returns: undefined
      }
      transition_perf_plan: {
        Args: { p_plan: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
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
      app_role: ["admin", "developer", "viewer"],
    },
  },
} as const
