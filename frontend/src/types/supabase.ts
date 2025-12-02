export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          user_id: string | null
          company_name: string
          linkedin_url: string | null
          linkedin_id: string | null
          industry: string | null
          employee_count: string | null
          headquarters: string | null
          website: string | null
          description: string | null
          search_query: string | null
          scraped_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_name: string
          linkedin_url?: string | null
          linkedin_id?: string | null
          industry?: string | null
          employee_count?: string | null
          headquarters?: string | null
          website?: string | null
          description?: string | null
          search_query?: string | null
          scraped_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          company_name?: string
          linkedin_url?: string | null
          linkedin_id?: string | null
          industry?: string | null
          employee_count?: string | null
          headquarters?: string | null
          website?: string | null
          description?: string | null
          search_query?: string | null
          scraped_at?: string | null
          created_at?: string | null
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string | null
          status: 'queued' | 'processing' | 'completed' | 'failed'
          payload: Json | null
          result_id: string | null
          error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          payload?: Json | null
          result_id?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          payload?: Json | null
          result_id?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      scrape_logs: {
        Row: {
          id: string
          request_payload: Json | null
          response_status: number | null
          error: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          request_payload?: Json | null
          response_status?: number | null
          error?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          request_payload?: Json | null
          response_status?: number | null
          error?: string | null
          created_at?: string | null
        }
      }
    }
  }
}
