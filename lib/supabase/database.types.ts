export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      board_columns: {
        Row: {
          board: string
          created_at: string
          field: string | null
          hidden: boolean
          id: string
          label: string
          options: Json
          position: number
          type: string
          updated_at: string
          width: number
        }
        Insert: {
          board: string
          label: string
          options?: Json
          position: number
          type: string
          width?: number
        }
        Update: {
          hidden?: boolean
          label?: string
          options?: Json
          position?: number
          type?: string
          width?: number
        }
        Relationships: []
      }
      course_interests: {
        Row: {
          custom: Json
          created_at: string
          email: string
          exam: string | null
          external_id: string
          id: string
          name: string | null
          notes: string | null
          score_pct: number | null
          source: string
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          custom?: Json
          email: string
          external_id: string
          source: string
          exam?: string | null
          name?: string | null
          notes?: string | null
          score_pct?: number | null
          status?: string
          submitted_at?: string
        }
        Update: {
          custom?: Json
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      crm_members: {
        Row: { added_at: string; email: string }
        Insert: { added_at?: string; email: string }
        Update: { added_at?: string; email?: string }
        Relationships: []
      }
      ingest_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          label: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          label: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          label?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          from_stage: string | null
          id: string
          kind: string
          lead_id: string
          to_stage: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          from_stage?: string | null
          id?: string
          kind: string
          lead_id: string
          to_stage?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          from_stage?: string | null
          id?: string
          kind?: string
          lead_id?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitments: {
        Row: {
          custom: Json
          board_group: string
          client: string
          contact: string | null
          contract: string | null
          created_at: string
          created_by: string | null
          das: string | null
          deposit: string | null
          est_start: string | null
          est_start_month: string | null
          id: string
          interview_date: string | null
          interviewees: string | null
          lead_id: string | null
          left_status: string | null
          monday_item_id: string | null
          notes: string | null
          shortlist_count: number | null
          shortlist_delivery: string | null
          signed_up_on: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          custom?: Json
          board_group?: string
          client: string
          contact?: string | null
          contract?: string | null
          das?: string | null
          deposit?: string | null
          est_start?: string | null
          est_start_month?: string | null
          interview_date?: string | null
          interviewees?: string | null
          lead_id?: string | null
          left_status?: string | null
          notes?: string | null
          shortlist_count?: number | null
          shortlist_delivery?: string | null
          signed_up_on?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          custom?: Json
          board_group?: string
          client?: string
          contact?: string | null
          contract?: string | null
          das?: string | null
          deposit?: string | null
          est_start?: string | null
          est_start_month?: string | null
          interview_date?: string | null
          interviewees?: string | null
          lead_id?: string | null
          left_status?: string | null
          notes?: string | null
          shortlist_count?: number | null
          shortlist_delivery?: string | null
          signed_up_on?: string | null
          source?: string | null
          status?: string
        }
        Relationships: []
      }
      lead_stages: {
        Row: { id: string; in_pipeline: boolean; label: string; position: number }
        Insert: { id: string; in_pipeline?: boolean; label: string; position: number }
        Update: { id?: string; in_pipeline?: boolean; label?: string; position?: number }
        Relationships: []
      }
      leads: {
        Row: {
          custom: Json
          active: boolean
          consent: boolean
          created_at: string
          email: string
          enquiry_type: string | null
          external_id: string
          id: string
          message: string | null
          monday_item_id: string | null
          name: string
          notes: string | null
          organisation: string | null
          phone: string | null
          source: string
          source_page: string | null
          stage: string
          stage_changed_at: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          custom?: Json
          active?: boolean
          consent?: boolean
          created_at?: string
          email: string
          enquiry_type?: string | null
          external_id: string
          id?: string
          message?: string | null
          monday_item_id?: string | null
          name: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          source: string
          source_page?: string | null
          stage?: string
          stage_changed_at?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          custom?: Json
          active?: boolean
          consent?: boolean
          created_at?: string
          email?: string
          enquiry_type?: string | null
          external_id?: string
          id?: string
          message?: string | null
          monday_item_id?: string | null
          name?: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          source?: string
          source_page?: string | null
          stage?: string
          stage_changed_at?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_stage_fkey"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      reorder_board_columns: {
        Args: { board_name: string; ids: string[] }
        Returns: undefined
      }
      set_custom_value: {
        Args: { column_id: string; row_id: string; target: string; value: Json }
        Returns: Json
      }
      ingest_website_lead: {
        Args: { key_hash: string; lead: Json }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
