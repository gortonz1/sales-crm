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
      lead_stages: {
        Row: { id: string; in_pipeline: boolean; label: string; position: number }
        Insert: { id: string; in_pipeline?: boolean; label: string; position: number }
        Update: { id?: string; in_pipeline?: boolean; label?: string; position?: number }
        Relationships: []
      }
      leads: {
        Row: {
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
