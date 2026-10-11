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
          deleted_at: string | null
          deleted_by: string | null
          board: string
          board_id: string | null
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
          board_id?: string | null
          label: string
          options?: Json
          position: number
          type: string
          width?: number
        }
        Update: {
          deleted_at?: string | null
          hidden?: boolean
          label?: string
          options?: Json
          position?: number
          type?: string
          width?: number
        }
        Relationships: []
      }
      board_groups: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          board_id: string
          color: string
          created_at: string
          id: string
          monday_group_id: string | null
          name: string
          position: number
        }
        Insert: {
          board_id: string
          color?: string
          monday_group_id?: string | null
          name: string
          position?: number
        }
        Update: {
          deleted_at?: string | null
          color?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_groups_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_items: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          board_id: string
          created_at: string
          created_by: string | null
          custom: Json
          group_id: string
          id: string
          monday_item_id: string | null
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          custom?: Json
          group_id: string
          monday_item_id?: string | null
          name: string
          position?: number
        }
        Update: {
          deleted_at?: string | null
          custom?: Json
          group_id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          created_at: string
          created_by: string | null
          id: string
          monday_board_id: string | null
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          monday_board_id?: string | null
          name: string
          position?: number
        }
        Update: {
          deleted_at?: string | null
          name?: string
          position?: number
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
          interest: string | null
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
          interest?: string | null
          name?: string | null
          notes?: string | null
          score_pct?: number | null
          status?: string
          submitted_at?: string
        }
        Update: {
          custom?: Json
          interest?: string | null
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      crm_members: {
        Row: { added_at: string; email: string; is_admin: boolean }
        Insert: { added_at?: string; email: string; is_admin?: boolean }
        Update: { added_at?: string; email?: string; is_admin?: boolean }
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
          interest: string | null
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
          external_id?: string
          id?: string
          interest?: string | null
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
          interest?: string | null
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
      crm_is_admin: { Args: never; Returns: boolean }
      crm_team: {
        Args: never
        Returns: {
          added_at: string
          email: string
          is_admin: boolean
          is_you: boolean
          signed_up: boolean
        }[]
      }
      crm_team_add: { Args: { member_email: string }; Returns: undefined }
      crm_team_remove: { Args: { member_email: string }; Returns: undefined }
      crm_team_set_admin: {
        Args: { make_admin: boolean; member_email: string }
        Returns: undefined
      }
      delete_forever: { Args: { entry_id: string; kind: string }; Returns: string[] }
      purge_bin: { Args: never; Returns: string[] }
      earnings_load: { Args: { session: string }; Returns: Json }
      earnings_lock: { Args: { session: string }; Returns: undefined }
      earnings_save: {
        Args: { plan: Json; report: Json; session: string }
        Returns: string
      }
      earnings_unlock: { Args: { attempt: string }; Returns: string }
      sage_connect: {
        Args: {
          business_id: string | null
          business_name: string | null
          refresh_expires_at: string | null
          session: string
          tokens: string
        }
        Returns: undefined
      }
      sage_disconnect: { Args: { session: string }; Returns: undefined }
      sage_load: { Args: { session: string }; Returns: Json }
      sage_rotate: {
        Args: {
          refresh_expires_at: string | null
          session: string
          tokens: string
        }
        Returns: undefined
      }
      reorder_board_columns: {
        Args: { board_name: string; ids: string[] }
        Returns: undefined
      }
      update_custom_files: {
        Args: {
          add_files: Json
          column_id: string
          remove_ids: string[]
          row_id: string
          target: string
        }
        Returns: Json
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
