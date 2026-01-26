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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      _archive_etl_jobs: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_text: string | null
          finished_at: string | null
          id: string | null
          idempotency_key: string | null
          job_type: string | null
          not_before: string | null
          params: Json | null
          priority: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          finished_at?: string | null
          id?: string | null
          idempotency_key?: string | null
          job_type?: string | null
          not_before?: string | null
          params?: Json | null
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          finished_at?: string | null
          id?: string | null
          idempotency_key?: string | null
          job_type?: string | null
          not_before?: string | null
          params?: Json | null
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
        }
        Relationships: []
      }
      _archive_storage_cleanup_queue: {
        Row: {
          bucket: string | null
          deleted_at: string | null
          enqueued_at: string | null
          id: number | null
          job_id: string | null
          key: string | null
        }
        Insert: {
          bucket?: string | null
          deleted_at?: string | null
          enqueued_at?: string | null
          id?: number | null
          job_id?: string | null
          key?: string | null
        }
        Update: {
          bucket?: string | null
          deleted_at?: string | null
          enqueued_at?: string | null
          id?: number | null
          job_id?: string | null
          key?: string | null
        }
        Relationships: []
      }
      _view_backups: {
        Row: {
          def: string | null
          saved_at: string | null
          schema_name: string | null
          view_name: string | null
        }
        Insert: {
          def?: string | null
          saved_at?: string | null
          schema_name?: string | null
          view_name?: string | null
        }
        Update: {
          def?: string | null
          saved_at?: string | null
          schema_name?: string | null
          view_name?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_name: string
          activity_name_norm: string | null
          area_id: number
          duration_days: number
          id: number
          kind_id: string | null
          section_id: number
          sub_section_id: number
        }
        Insert: {
          activity_name: string
          activity_name_norm?: string | null
          area_id: number
          duration_days?: number
          id?: number
          kind_id?: string | null
          section_id: number
          sub_section_id: number
        }
        Update: {
          activity_name?: string
          activity_name_norm?: string | null
          area_id?: number
          duration_days?: number
          id?: number
          kind_id?: string | null
          section_id?: number
          sub_section_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activities_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_sub_section_id_fkey"
            columns: ["sub_section_id"]
            isOneToOne: false
            referencedRelation: "subsections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_kind"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "activity_kinds"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_kinds: {
        Row: {
          created_at: string
          id: string
          name: string
          name_norm: string
          short_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_norm: string
          short_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_norm?: string
          short_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit: {
        Row: {
          action_type: string
          admin_user_id: string | null
          created_at: string | null
          details: string | null
          id: number
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: number
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: number
          target_user_id?: string | null
        }
        Relationships: []
      }
      agent_heartbeats: {
        Row: {
          agent_ver: string | null
          hostname: string
          last_error: string | null
          last_seen_at: string
        }
        Insert: {
          agent_ver?: string | null
          hostname: string
          last_error?: string | null
          last_seen_at: string
        }
        Update: {
          agent_ver?: string | null
          hostname?: string
          last_error?: string | null
          last_seen_at?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          area_name: string
          id: number
          section_id: number
          subsection_id: number | null
        }
        Insert: {
          area_name: string
          id?: number
          section_id: number
          subsection_id?: number | null
        }
        Update: {
          area_name?: string
          id?: number
          section_id?: number
          subsection_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_subsection_id_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "subsections"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_plan_batches: {
        Row: {
          batch_no_seq: number
          batch_size: number
          bmr_id: number | null
          bmr_linked_at: string | null
          bmr_linked_by: string | null
          created_at: string
          header_id: number
          id: number
          line_id: number
          month_start: string
          notes: string | null
          product_id: number
          source_rule: string
          updated_at: string
        }
        Insert: {
          batch_no_seq: number
          batch_size: number
          bmr_id?: number | null
          bmr_linked_at?: string | null
          bmr_linked_by?: string | null
          created_at?: string
          header_id: number
          id?: number
          line_id: number
          month_start: string
          notes?: string | null
          product_id: number
          source_rule: string
          updated_at?: string
        }
        Update: {
          batch_no_seq?: number
          batch_size?: number
          bmr_id?: number | null
          bmr_linked_at?: string | null
          bmr_linked_by?: string | null
          created_at?: string
          header_id?: number
          id?: number
          line_id?: number
          month_start?: string
          notes?: string | null
          product_id?: number
          source_rule?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_lines_enriched"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_pm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_requirement"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_rm_pm_issues_clean"
            referencedColumns: ["bmr_id"]
          },
        ]
      }
      batch_plan_headers: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          plan_month: string | null
          plan_title: string
          status: string
          updated_at: string
          window_from: string
          window_to: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          plan_month?: string | null
          plan_title: string
          status?: string
          updated_at?: string
          window_from: string
          window_to: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          plan_month?: string | null
          plan_title?: string
          status?: string
          updated_at?: string
          window_from?: string
          window_to?: string
        }
        Relationships: []
      }
      batch_plan_lines: {
        Row: {
          batch_count: number
          created_at: string
          final_make_qty: number
          header_id: number
          id: number
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string
          notes: string | null
          preferred_batch_size: number | null
          product_id: number
          residual_qty: number
          updated_at: string
        }
        Insert: {
          batch_count?: number
          created_at?: string
          final_make_qty: number
          header_id: number
          id?: number
          max_batch_size?: number | null
          min_batch_size?: number | null
          month_start: string
          notes?: string | null
          preferred_batch_size?: number | null
          product_id: number
          residual_qty?: number
          updated_at?: string
        }
        Update: {
          batch_count?: number
          created_at?: string
          final_make_qty?: number
          header_id?: number
          id?: number
          max_batch_size?: number | null
          min_batch_size?: number | null
          month_start?: string
          notes?: string | null
          preferred_batch_size?: number | null
          product_id?: number
          residual_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
        ]
      }
      bmr_details: {
        Row: {
          batch_size: number
          bn: string
          created_at: string | null
          id: number
          item: string
          product_id: number
          uom: string | null
        }
        Insert: {
          batch_size: number
          bn: string
          created_at?: string | null
          id?: number
          item: string
          product_id: number
          uom?: string | null
        }
        Update: {
          batch_size?: number
          bn?: string
          created_at?: string | null
          id?: number
          item?: string
          product_id?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      categories: {
        Row: {
          category_name: string
          id: number
        }
        Insert: {
          category_name: string
          id?: number
        }
        Update: {
          category_name?: string
          id?: number
        }
        Relationships: []
      }
      daily_work_log: {
        Row: {
          activity: string
          area_id: number
          batch_number: string
          batch_size: number
          batch_uom: string
          completed_on: string | null
          count_of_saravam: number | null
          created_at: string
          due_date: string
          fuel: string | null
          fuel_over: string | null
          fuel_under: string | null
          id: number
          item: string
          juice_or_decoction: string | null
          lab_ref_number: string | null
          log_date: string
          plant_id: number | null
          qty_after_process: number | null
          qty_uom: string | null
          remarks: string | null
          rm_juice_qty: number | null
          rm_juice_uom: string | null
          section_id: number
          sku_breakdown: string | null
          specify: string | null
          started_on: string
          status: string
          storage_qty: number | null
          storage_qty_uom: string | null
          subsection_id: number
          uploaded_by: string | null
        }
        Insert: {
          activity: string
          area_id: number
          batch_number: string
          batch_size: number
          batch_uom: string
          completed_on?: string | null
          count_of_saravam?: number | null
          created_at?: string
          due_date: string
          fuel?: string | null
          fuel_over?: string | null
          fuel_under?: string | null
          id?: number
          item: string
          juice_or_decoction?: string | null
          lab_ref_number?: string | null
          log_date: string
          plant_id?: number | null
          qty_after_process?: number | null
          qty_uom?: string | null
          remarks?: string | null
          rm_juice_qty?: number | null
          rm_juice_uom?: string | null
          section_id: number
          sku_breakdown?: string | null
          specify?: string | null
          started_on: string
          status: string
          storage_qty?: number | null
          storage_qty_uom?: string | null
          subsection_id: number
          uploaded_by?: string | null
        }
        Update: {
          activity?: string
          area_id?: number
          batch_number?: string
          batch_size?: number
          batch_uom?: string
          completed_on?: string | null
          count_of_saravam?: number | null
          created_at?: string
          due_date?: string
          fuel?: string | null
          fuel_over?: string | null
          fuel_under?: string | null
          id?: number
          item?: string
          juice_or_decoction?: string | null
          lab_ref_number?: string | null
          log_date?: string
          plant_id?: number | null
          qty_after_process?: number | null
          qty_uom?: string | null
          remarks?: string | null
          rm_juice_qty?: number | null
          rm_juice_uom?: string | null
          section_id?: number
          sku_breakdown?: string | null
          specify?: string | null
          started_on?: string
          status?: string
          storage_qty?: number | null
          storage_qty_uom?: string | null
          subsection_id?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_work_log_area_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_log_plant_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plant_machinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_log_section_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_log_subsection_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "subsections"
            referencedColumns: ["id"]
          },
        ]
      }
      etl_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      etl_health_log: {
        Row: {
          checked_at: string
          details: Json | null
          id: number
          message: string
          status: string
        }
        Insert: {
          checked_at?: string
          details?: Json | null
          id?: number
          message: string
          status: string
        }
        Update: {
          checked_at?: string
          details?: Json | null
          id?: number
          message?: string
          status?: string
        }
        Relationships: []
      }
      etl_jobs: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_text: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          job_type: string
          not_before: string | null
          params: Json | null
          priority: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          vreg_date_extracted: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type: string
          not_before?: string | null
          params?: Json | null
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          vreg_date_extracted?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: string
          not_before?: string | null
          params?: Json | null
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          vreg_date_extracted?: string | null
        }
        Relationships: []
      }
      etl_presets: {
        Row: {
          enabled: boolean
          hints: string | null
          label: string
          preset_key: string
          sort_order: number
        }
        Insert: {
          enabled?: boolean
          hints?: string | null
          label: string
          preset_key: string
          sort_order?: number
        }
        Update: {
          enabled?: boolean
          hints?: string | null
          label?: string
          preset_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_skus: {
        Row: {
          count: number
          id: number
          packaging_event_id: number
          sku_id: number
        }
        Insert: {
          count: number
          id?: number
          packaging_event_id: number
          sku_id: number
        }
        Update: {
          count?: number
          id?: number
          packaging_event_id?: number
          sku_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_skus_packaging_event_id_fkey"
            columns: ["packaging_event_id"]
            isOneToOne: false
            referencedRelation: "packaging_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      event_type_lkp: {
        Row: {
          active: boolean
          affects_bottled_stock: number
          affects_bulk_stock: number
          code: string
          is_packaging: boolean
          label: string
        }
        Insert: {
          active?: boolean
          affects_bottled_stock?: number
          affects_bulk_stock?: number
          code: string
          is_packaging?: boolean
          label: string
        }
        Update: {
          active?: boolean
          affects_bottled_stock?: number
          affects_bulk_stock?: number
          code?: string
          is_packaging?: boolean
          label?: string
        }
        Relationships: []
      }
      fg_bulk_stock_ledger: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          id: number
          movement_date: string
          product_id: number
          qty: number
          qty_base: number
          reason_code: string
          source_id: number
          source_table: string
          uom: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          id?: number
          movement_date?: string
          product_id: number
          qty: number
          qty_base: number
          reason_code: string
          source_id: number
          source_table: string
          uom: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          id?: number
          movement_date?: string
          product_id?: number
          qty?: number
          qty_base?: number
          reason_code?: string
          source_id?: number
          source_table?: string
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fg_bulk_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      forecast_demand_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          delta_units: number
          godown_id: number
          id: number
          is_active: boolean
          month_start: string
          reason: string | null
          region_id: number
          sku_id: number
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta_units?: number
          godown_id: number
          id?: number
          is_active?: boolean
          month_start: string
          reason?: string | null
          region_id: number
          sku_id: number
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta_units?: number
          godown_id?: number
          id?: number
          is_active?: boolean
          month_start?: string
          reason?: string | null
          region_id?: number
          sku_id?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      forecast_model_run: {
        Row: {
          created_at: string
          id: number
          metrics_json: Json
          model_key: string
          params_json: Json
          run_id: number
          slot: string
        }
        Insert: {
          created_at?: string
          id?: number
          metrics_json?: Json
          model_key: string
          params_json?: Json
          run_id: number
          slot: string
        }
        Update: {
          created_at?: string
          id?: number
          metrics_json?: Json
          model_key?: string
          params_json?: Json
          run_id?: number
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_model_run_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_model_run_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_forecast_runs_recent"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_run: {
        Row: {
          as_of_date: string
          closed_at: string | null
          created_at: string
          frozen_after_day: number
          horizon_months: number
          id: number
          module_slot: string
          notes: string | null
          status: string
        }
        Insert: {
          as_of_date: string
          closed_at?: string | null
          created_at?: string
          frozen_after_day: number
          horizon_months: number
          id?: number
          module_slot: string
          notes?: string | null
          status?: string
        }
        Update: {
          as_of_date?: string
          closed_at?: string | null
          created_at?: string
          frozen_after_day?: number
          horizon_months?: number
          id?: number
          module_slot?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      godown_aliases: {
        Row: {
          alias_key: string
          alias_text: string
          created_at: string | null
          godown_id: number
          note: string | null
        }
        Insert: {
          alias_key?: string
          alias_text: string
          created_at?: string | null
          godown_id: number
          note?: string | null
        }
        Update: {
          alias_key?: string
          alias_text?: string
          created_at?: string | null
          godown_id?: number
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
        ]
      }
      godowns: {
        Row: {
          code: string
          id: number
          name: string
          region_id: number
        }
        Insert: {
          code: string
          id?: number
          name: string
          region_id: number
        }
        Update: {
          code?: string
          id?: number
          name?: string
          region_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
        ]
      }
      hub_access_requests: {
        Row: {
          created_at: string
          id: number
          note: string | null
          status: string
          user_id: string
          utility_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          note?: string | null
          status?: string
          user_id: string
          utility_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          note?: string | null
          status?: string
          user_id?: string
          utility_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_access_requests_utility_id_fkey"
            columns: ["utility_id"]
            isOneToOne: false
            referencedRelation: "hub_utilities"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hub_user_access: {
        Row: {
          level: Database["public"]["Enums"]["hub_access_level"]
          user_id: string
          utility_id: string
        }
        Insert: {
          level?: Database["public"]["Enums"]["hub_access_level"]
          user_id: string
          utility_id: string
        }
        Update: {
          level?: Database["public"]["Enums"]["hub_access_level"]
          user_id?: string
          utility_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_user_access_utility_id_fkey"
            columns: ["utility_id"]
            isOneToOne: false
            referencedRelation: "hub_utilities"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_utilities: {
        Row: {
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      import_log: {
        Row: {
          by_user: string | null
          id: number
          notes: string | null
          ran_at: string
          row_count: number | null
        }
        Insert: {
          by_user?: string | null
          id?: number
          notes?: string | null
          ran_at?: string
          row_count?: number | null
        }
        Update: {
          by_user?: string | null
          id?: number
          notes?: string | null
          ran_at?: string
          row_count?: number | null
        }
        Relationships: []
      }
      inv_class_category: {
        Row: {
          code: string
          id: number
          label: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          id?: number
          label: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          id?: number
          label?: string
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      inv_class_group: {
        Row: {
          abbr: string | null
          code: string
          id: number
          label: string
          label_ml: string | null
          notes: string | null
          sort_order: number | null
          subcategory_id: number
        }
        Insert: {
          abbr?: string | null
          code: string
          id?: number
          label: string
          label_ml?: string | null
          notes?: string | null
          sort_order?: number | null
          subcategory_id: number
        }
        Update: {
          abbr?: string | null
          code?: string
          id?: number
          label?: string
          label_ml?: string | null
          notes?: string | null
          sort_order?: number | null
          subcategory_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inv_class_group_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_class_subcategory: {
        Row: {
          category_id: number
          code: string
          id: number
          label: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          category_id: number
          code: string
          id?: number
          label: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: number
          code?: string
          id?: number
          label?: string
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_class_subcategory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_class_subgroup: {
        Row: {
          abbr: string | null
          code: string
          group_id: number
          id: number
          label: string
          label_ml: string | null
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          abbr?: string | null
          code: string
          group_id: number
          id?: number
          label: string
          label_ml?: string | null
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          abbr?: string | null
          code?: string
          group_id?: number
          id?: number
          label?: string
          label_ml?: string | null
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_class_subgroup_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_rm_form_conversion: {
        Row: {
          consume_stock_item_id: number
          consume_uom_id: number | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          factor: number
          id: number
          is_active: boolean
          notes: string | null
          purchase_stock_item_id: number
          purchase_uom_id: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consume_stock_item_id: number
          consume_uom_id?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          factor: number
          id?: number
          is_active?: boolean
          notes?: string | null
          purchase_stock_item_id: number
          purchase_uom_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consume_stock_item_id?: number
          consume_uom_id?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          factor?: number
          id?: number
          is_active?: boolean
          notes?: string | null
          purchase_stock_item_id?: number
          purchase_uom_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_stock_item_id_fkey"
            columns: ["consume_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_uom_id_fkey"
            columns: ["consume_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_uom_id_fkey"
            columns: ["consume_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_consume_uom_id_fkey"
            columns: ["consume_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_stock_item_id_fkey"
            columns: ["purchase_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_rm_form_conversion_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_item: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          default_uom_id: number
          hsn_code: string | null
          id: number
          last_updated_at: string
          last_updated_by: string | null
          name: string
          notes: string | null
        }
        Insert: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          default_uom_id: number
          hsn_code?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          name: string
          notes?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          default_uom_id?: number
          hsn_code?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_item_alias: {
        Row: {
          alias_key: string
          created_at: string
          created_by: string | null
          first_seen: string | null
          id: number
          inv_stock_item_id: number | null
          last_seen: string | null
          last_updated_at: string
          last_updated_by: string | null
          note: string | null
          source_kind: string
          source_system: string
          status: string
          tally_item_name: string
        }
        Insert: {
          alias_key: string
          created_at?: string
          created_by?: string | null
          first_seen?: string | null
          id?: number
          inv_stock_item_id?: number | null
          last_seen?: string | null
          last_updated_at?: string
          last_updated_by?: string | null
          note?: string | null
          source_kind: string
          source_system?: string
          status?: string
          tally_item_name: string
        }
        Update: {
          alias_key?: string
          created_at?: string
          created_by?: string | null
          first_seen?: string | null
          id?: number
          inv_stock_item_id?: number | null
          last_seen?: string | null
          last_updated_at?: string
          last_updated_by?: string | null
          note?: string | null
          source_kind?: string
          source_system?: string
          status?: string
          tally_item_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      inv_stock_item_class_map: {
        Row: {
          category_id: number
          group_id: number | null
          stock_item_id: number
          subcategory_id: number | null
          subgroup_id: number | null
        }
        Insert: {
          category_id: number
          group_id?: number | null
          stock_item_id: number
          subcategory_id?: number | null
          subgroup_id?: number | null
        }
        Update: {
          category_id?: number
          group_id?: number | null
          stock_item_id?: number
          subcategory_id?: number | null
          subgroup_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_item_moq_policy: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: number
          is_active: boolean
          material_kind: string
          moq_qty: number
          note: string | null
          stock_item_id: number
          uom_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: number
          is_active?: boolean
          material_kind: string
          moq_qty: number
          note?: string | null
          stock_item_id: number
          uom_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: number
          is_active?: boolean
          material_kind?: string
          moq_qty?: number
          note?: string | null
          stock_item_id?: number
          uom_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_moq_policy_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_item_season_profile: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          notes: string | null
          season_profile_id: number
          stock_item_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          season_profile_id: number
          stock_item_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          season_profile_id?: number
          stock_item_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_season_profile_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: true
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      inv_uom: {
        Row: {
          code: string
          dimension_id: number
          id: number
          is_base: boolean
          notes: string | null
        }
        Insert: {
          code: string
          dimension_id: number
          id?: number
          is_base?: boolean
          notes?: string | null
        }
        Update: {
          code?: string
          dimension_id?: number
          id?: number
          is_base?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_uom_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "inv_uom_dimension"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_uom_conversion: {
        Row: {
          dimension_id: number
          factor: number
          from_uom_id: number
          id: number
          notes: string | null
          to_uom_id: number
        }
        Insert: {
          dimension_id: number
          factor: number
          from_uom_id: number
          id?: number
          notes?: string | null
          to_uom_id: number
        }
        Update: {
          dimension_id?: number
          factor?: number
          from_uom_id?: number
          id?: number
          notes?: string | null
          to_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inv_uom_conversion_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "inv_uom_dimension"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_from_uom_id_fkey"
            columns: ["from_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_from_uom_id_fkey"
            columns: ["from_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_from_uom_id_fkey"
            columns: ["from_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_to_uom_id_fkey"
            columns: ["to_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_to_uom_id_fkey"
            columns: ["to_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_uom_conversion_to_uom_id_fkey"
            columns: ["to_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_uom_dimension: {
        Row: {
          id: number
          name: string
          notes: string | null
        }
        Insert: {
          id?: number
          name: string
          notes?: string | null
        }
        Update: {
          id?: number
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      machine_types: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      manual_plan_lines: {
        Row: {
          created_at: string
          id: number
          month_start: string
          note: string | null
          product_id: number
          proposed_qty: number
          set_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          month_start: string
          note?: string | null
          product_id: number
          proposed_qty: number
          set_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          month_start?: string
          note?: string | null
          product_id?: number
          proposed_qty?: number
          set_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "manual_plan_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_plan_sets: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          note: string | null
          seeded_from_system: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          note?: string | null
          seeded_from_system?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          note?: string | null
          seeded_from_system?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_export_settings: {
        Row: {
          id: number
          months_ahead: number
          updated_at: string
        }
        Insert: {
          id?: number
          months_ahead?: number
          updated_at?: string
        }
        Update: {
          id?: number
          months_ahead?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_overrides_staging: {
        Row: {
          delta_units: number
          godown_id: number
          id: number
          month_start: string
          note: string | null
          region_id: number
          sku_id: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          delta_units: number
          godown_id: number
          id?: number
          month_start: string
          note?: string | null
          region_id: number
          sku_id: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          delta_units?: number
          godown_id?: number
          id?: number
          month_start?: string
          note?: string | null
          region_id?: number
          sku_id?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      mrp_plm_fill_plan_monthly: {
        Row: {
          curr_mos: number | null
          forecast_units_pm: number | null
          gap_mos: number | null
          horizon_end: string
          horizon_start: string
          inserted_at: string
          is_optional_plm: boolean
          planned_plm_qty: number
          plm_name: string | null
          plm_qty_per_unit: number
          plm_stock_item_id: number
          plm_uom: string | null
          product_id: number
          region_code: string
          sku_id: number
          stock_units: number | null
          target_mos: number | null
          units_to_fill: number | null
          used_base_qty: number | null
        }
        Insert: {
          curr_mos?: number | null
          forecast_units_pm?: number | null
          gap_mos?: number | null
          horizon_end: string
          horizon_start: string
          inserted_at?: string
          is_optional_plm?: boolean
          planned_plm_qty: number
          plm_name?: string | null
          plm_qty_per_unit: number
          plm_stock_item_id: number
          plm_uom?: string | null
          product_id: number
          region_code: string
          sku_id: number
          stock_units?: number | null
          target_mos?: number | null
          units_to_fill?: number | null
          used_base_qty?: number | null
        }
        Update: {
          curr_mos?: number | null
          forecast_units_pm?: number | null
          gap_mos?: number | null
          horizon_end?: string
          horizon_start?: string
          inserted_at?: string
          is_optional_plm?: boolean
          planned_plm_qty?: number
          plm_name?: string | null
          plm_qty_per_unit?: number
          plm_stock_item_id?: number
          plm_uom?: string | null
          product_id?: number
          region_code?: string
          sku_id?: number
          stock_units?: number | null
          target_mos?: number | null
          units_to_fill?: number | null
          used_base_qty?: number | null
        }
        Relationships: []
      }
      mrp_plm_issue_lines: {
        Row: {
          allocation_note: string | null
          allocation_status: string
          batch_number: string | null
          created_at: string
          fg_batch_id: number | null
          godown_from: string | null
          godown_to: string | null
          id: number
          issue_date: string
          plm_name: string | null
          plm_stock_item_id: number
          plm_uom_code: string
          plm_uom_id: number
          product_id: number | null
          qty_issued: number
          raw_batch_number: string | null
          raw_product_text: string | null
          raw_remarks: string | null
          region_code: string | null
          sku_id: number | null
          source_row: number
          updated_at: string
          voucher_id: string
          voucher_number: string | null
          voucher_ref: string | null
          voucher_type: string | null
        }
        Insert: {
          allocation_note?: string | null
          allocation_status?: string
          batch_number?: string | null
          created_at?: string
          fg_batch_id?: number | null
          godown_from?: string | null
          godown_to?: string | null
          id?: number
          issue_date: string
          plm_name?: string | null
          plm_stock_item_id: number
          plm_uom_code: string
          plm_uom_id: number
          product_id?: number | null
          qty_issued: number
          raw_batch_number?: string | null
          raw_product_text?: string | null
          raw_remarks?: string | null
          region_code?: string | null
          sku_id?: number | null
          source_row: number
          updated_at?: string
          voucher_id: string
          voucher_number?: string | null
          voucher_ref?: string | null
          voucher_type?: string | null
        }
        Update: {
          allocation_note?: string | null
          allocation_status?: string
          batch_number?: string | null
          created_at?: string
          fg_batch_id?: number | null
          godown_from?: string | null
          godown_to?: string | null
          id?: number
          issue_date?: string
          plm_name?: string | null
          plm_stock_item_id?: number
          plm_uom_code?: string
          plm_uom_id?: number
          product_id?: number | null
          qty_issued?: number
          raw_batch_number?: string | null
          raw_product_text?: string | null
          raw_remarks?: string | null
          region_code?: string | null
          sku_id?: number | null
          source_row?: number
          updated_at?: string
          voucher_id?: string
          voucher_number?: string | null
          voucher_ref?: string | null
          voucher_type?: string | null
        }
        Relationships: []
      }
      mrp_rm_issue_lines: {
        Row: {
          allocation_note: string | null
          allocation_status: string
          batch_number: string | null
          batch_number_key: string | null
          created_at: string
          fg_batch_id: number | null
          id: number
          issue_date: string
          product_id: number | null
          qty_issued: number
          raw_batch_number: string | null
          raw_material_key: string | null
          raw_material_text: string | null
          raw_product_text: string | null
          raw_remarks: string | null
          region_code: string | null
          rm_name: string | null
          rm_stock_item_id: number
          rm_uom_code: string
          rm_uom_id: number
          sku_id: number | null
          updated_at: string
          voucher_id: string
          voucher_number: string | null
          voucher_ref: string | null
          voucher_type: string | null
        }
        Insert: {
          allocation_note?: string | null
          allocation_status?: string
          batch_number?: string | null
          batch_number_key?: string | null
          created_at?: string
          fg_batch_id?: number | null
          id?: number
          issue_date: string
          product_id?: number | null
          qty_issued: number
          raw_batch_number?: string | null
          raw_material_key?: string | null
          raw_material_text?: string | null
          raw_product_text?: string | null
          raw_remarks?: string | null
          region_code?: string | null
          rm_name?: string | null
          rm_stock_item_id: number
          rm_uom_code: string
          rm_uom_id: number
          sku_id?: number | null
          updated_at?: string
          voucher_id: string
          voucher_number?: string | null
          voucher_ref?: string | null
          voucher_type?: string | null
        }
        Update: {
          allocation_note?: string | null
          allocation_status?: string
          batch_number?: string | null
          batch_number_key?: string | null
          created_at?: string
          fg_batch_id?: number | null
          id?: number
          issue_date?: string
          product_id?: number | null
          qty_issued?: number
          raw_batch_number?: string | null
          raw_material_key?: string | null
          raw_material_text?: string | null
          raw_product_text?: string | null
          raw_remarks?: string | null
          region_code?: string | null
          rm_name?: string | null
          rm_stock_item_id?: number
          rm_uom_code?: string
          rm_uom_id?: number
          sku_id?: number | null
          updated_at?: string
          voucher_id?: string
          voucher_number?: string | null
          voucher_ref?: string | null
          voucher_type?: string | null
        }
        Relationships: []
      }
      mrp_rm_overlay_season_detail: {
        Row: {
          baseline_month_start: string
          baseline_qty: number
          created_at: string
          overlay_run_id: string
          procure_month_start: string
          procure_qty: number
          product_id: number
          rm_stock_item_id: number
          season_profile_id: number
          weight_used: number | null
        }
        Insert: {
          baseline_month_start: string
          baseline_qty: number
          created_at?: string
          overlay_run_id: string
          procure_month_start: string
          procure_qty: number
          product_id: number
          rm_stock_item_id: number
          season_profile_id: number
          weight_used?: number | null
        }
        Update: {
          baseline_month_start?: string
          baseline_qty?: number
          created_at?: string
          overlay_run_id?: string
          procure_month_start?: string
          procure_qty?: number
          product_id?: number
          rm_stock_item_id?: number
          season_profile_id?: number
          weight_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
        ]
      }
      mrp_rm_overlay_season_runs: {
        Row: {
          built_at: string
          built_by: string | null
          is_active: boolean
          notes: string | null
          overlay_run_id: string
          plan_end: string
          plan_start: string
        }
        Insert: {
          built_at?: string
          built_by?: string | null
          is_active?: boolean
          notes?: string | null
          overlay_run_id?: string
          plan_end: string
          plan_start: string
        }
        Update: {
          built_at?: string
          built_by?: string | null
          is_active?: boolean
          notes?: string | null
          overlay_run_id?: string
          plan_end?: string
          plan_start?: string
        }
        Relationships: []
      }
      mrp_rm_plan_detail: {
        Row: {
          calc_notes: string | null
          driver_ref_id: string
          driver_type: string
          explosion_path: Json
          level: number
          month_start: string
          mrp_run_id: string
          parent_bom_id: number
          parent_bom_line_id: number
          parent_bom_type: string
          parent_good_output_qty: number
          parent_item_id: number
          parent_multiplier: number
          plan_good_output_qty: number
          required_qty: number
          required_uom_id: number
          root_bom_id: number
          root_item_id: number
          root_item_type: string
          root_multiplier: number
          source: string
          stock_item_id: number
          top_product_id: number
        }
        Insert: {
          calc_notes?: string | null
          driver_ref_id: string
          driver_type: string
          explosion_path: Json
          level: number
          month_start: string
          mrp_run_id: string
          parent_bom_id: number
          parent_bom_line_id: number
          parent_bom_type: string
          parent_good_output_qty: number
          parent_item_id: number
          parent_multiplier: number
          plan_good_output_qty: number
          required_qty: number
          required_uom_id: number
          root_bom_id: number
          root_item_id: number
          root_item_type: string
          root_multiplier: number
          source: string
          stock_item_id: number
          top_product_id: number
        }
        Update: {
          calc_notes?: string | null
          driver_ref_id?: string
          driver_type?: string
          explosion_path?: Json
          level?: number
          month_start?: string
          mrp_run_id?: string
          parent_bom_id?: number
          parent_bom_line_id?: number
          parent_bom_type?: string
          parent_good_output_qty?: number
          parent_item_id?: number
          parent_multiplier?: number
          plan_good_output_qty?: number
          required_qty?: number
          required_uom_id?: number
          root_bom_id?: number
          root_item_id?: number
          root_item_type?: string
          root_multiplier?: number
          source?: string
          stock_item_id?: number
          top_product_id?: number
        }
        Relationships: []
      }
      mrp_rm_plan_month_runs: {
        Row: {
          built_at: string
          built_by: string | null
          is_active: boolean
          month_start: string
          mrp_run_id: string
          notes: string | null
        }
        Insert: {
          built_at?: string
          built_by?: string | null
          is_active?: boolean
          month_start: string
          mrp_run_id: string
          notes?: string | null
        }
        Update: {
          built_at?: string
          built_by?: string | null
          is_active?: boolean
          month_start?: string
          mrp_run_id?: string
          notes?: string | null
        }
        Relationships: []
      }
      mrp_rm_plan_monthly: {
        Row: {
          created_at: string
          horizon_end: string
          horizon_start: string
          planned_total_rm_qty: number
          rm_name: string | null
          rm_stock_item_id: number
          rm_uom_code: string
          rm_uom_id: number
          top_consuming_products: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          horizon_end: string
          horizon_start: string
          planned_total_rm_qty?: number
          rm_name?: string | null
          rm_stock_item_id: number
          rm_uom_code: string
          rm_uom_id: number
          top_consuming_products?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          horizon_end?: string
          horizon_start?: string
          planned_total_rm_qty?: number
          rm_name?: string | null
          rm_stock_item_id?: number
          rm_uom_code?: string
          rm_uom_id?: number
          top_consuming_products?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      packaging_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          work_log_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          work_log_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          work_log_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "packaging_events_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "event_type_lkp"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "packaging_events_work_log_id_fkey"
            columns: ["work_log_id"]
            isOneToOne: true
            referencedRelation: "daily_work_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_events_work_log_id_fkey"
            columns: ["work_log_id"]
            isOneToOne: true
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["work_log_id"]
          },
        ]
      }
      permission_targets: {
        Row: {
          created_at: string
          is_assignable: boolean
          key: string
          kind: string
          label: string
          meta: Json
          sort_order: number
        }
        Insert: {
          created_at?: string
          is_assignable?: boolean
          key: string
          kind: string
          label: string
          meta?: Json
          sort_order?: number
        }
        Update: {
          created_at?: string
          is_assignable?: boolean
          key?: string
          kind?: string
          label?: string
          meta?: Json
          sort_order?: number
        }
        Relationships: []
      }
      plan_publish_headers: {
        Row: {
          as_of_date: string
          created_at: string
          created_by: string | null
          id: number
          notes: string | null
          plan_key: string
        }
        Insert: {
          as_of_date: string
          created_at?: string
          created_by?: string | null
          id?: number
          notes?: string | null
          plan_key: string
        }
        Update: {
          as_of_date?: string
          created_at?: string
          created_by?: string | null
          id?: number
          notes?: string | null
          plan_key?: string
        }
        Relationships: []
      }
      plan_publish_lines: {
        Row: {
          created_at: string
          demand_baseline: number
          godown_id: number
          month_start: string
          plan_id: number
          region_id: number
          sku_id: number
          supply_final: number
          supply_llt: number | null
          supply_seasonal: number | null
        }
        Insert: {
          created_at?: string
          demand_baseline: number
          godown_id: number
          month_start: string
          plan_id: number
          region_id: number
          sku_id: number
          supply_final: number
          supply_llt?: number | null
          supply_seasonal?: number | null
        }
        Update: {
          created_at?: string
          demand_baseline?: number
          godown_id?: number
          month_start?: string
          plan_id?: number
          region_id?: number
          sku_id?: number
          supply_final?: number
          supply_llt?: number | null
          supply_seasonal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_publish_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_publish_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_machinery: {
        Row: {
          area_id: number
          id: number
          plant_name: string
          section_id: number
          status: string
          subsection_id: number
          type_id: number
        }
        Insert: {
          area_id: number
          id?: number
          plant_name: string
          section_id: number
          status: string
          subsection_id: number
          type_id: number
        }
        Update: {
          area_id?: number
          id?: number
          plant_name?: string
          section_id?: number
          status?: string
          subsection_id?: number
          type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plant_machinery_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_machinery_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_machinery_subsection_id_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "subsections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_machinery_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_bom_header: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          last_updated_at: string
          last_updated_by: string | null
          notes: string | null
          process_loss_pct: number
          reference_output_qty: number
          reference_output_uom_id: number
          sku_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          process_loss_pct?: number
          reference_output_qty: number
          reference_output_uom_id: number
          sku_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          process_loss_pct?: number
          reference_output_qty?: number
          reference_output_uom_id?: number
          sku_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_bom_header_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      plm_bom_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          plm_bom_id: number
          qty_per_reference_output: number
          remarks: string | null
          stock_item_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          plm_bom_id: number
          qty_per_reference_output: number
          remarks?: string | null
          stock_item_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          plm_bom_id?: number
          qty_per_reference_output?: number
          remarks?: string | null
          stock_item_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_bom_line_plm_bom_id_fkey"
            columns: ["plm_bom_id"]
            isOneToOne: false
            referencedRelation: "plm_bom_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_bom_tpl_header: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          last_updated_at: string
          last_updated_by: string | null
          notes: string | null
          pack_format_code: string
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          pack_format_code: string
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          pack_format_code?: string
          reference_output_qty?: number
          reference_output_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plm_bom_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_bom_tpl_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          qty_per_reference_output: number
          remarks: string | null
          stock_item_id: number
          tpl_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          qty_per_reference_output: number
          remarks?: string | null
          stock_item_id: number
          tpl_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          qty_per_reference_output?: number
          remarks?: string | null
          stock_item_id?: number
          tpl_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "plm_bom_tpl_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_bom_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_pack_format: {
        Row: {
          code: string
          id: number
          notes: string | null
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Insert: {
          code: string
          id?: number
          notes?: string | null
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Update: {
          code?: string
          id?: number
          notes?: string | null
          reference_output_qty?: number
          reference_output_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plm_pack_format_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_pack_format_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_pack_format_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_pack_format_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          pack_format_id: number
          qty_per_reference_output: number
          remarks: string | null
          stock_item_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          pack_format_id: number
          qty_per_reference_output: number
          remarks?: string | null
          stock_item_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          pack_format_id?: number
          qty_per_reference_output?: number
          remarks?: string | null
          stock_item_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_pack_format_line_pack_format_id_fkey"
            columns: ["pack_format_id"]
            isOneToOne: false
            referencedRelation: "plm_pack_format"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_pack_format_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_sku_pack_map: {
        Row: {
          created_at: string
          last_updated_at: string
          notes: string | null
          sku_id: number
          tpl_id: number
        }
        Insert: {
          created_at?: string
          last_updated_at?: string
          notes?: string | null
          sku_id: number
          tpl_id: number
        }
        Update: {
          created_at?: string
          last_updated_at?: string
          notes?: string | null
          sku_id?: number
          tpl_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "plm_tpl_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "v_pack_format_picker"
            referencedColumns: ["tpl_id"]
          },
        ]
      }
      plm_sku_plm_override: {
        Row: {
          id: number
          is_optional: boolean | null
          op: string
          qty_per_reference_output: number | null
          remarks: string | null
          sku_id: number
          stock_item_id: number
          uom_id: number | null
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean | null
          op: string
          qty_per_reference_output?: number | null
          remarks?: string | null
          sku_id: number
          stock_item_id: number
          uom_id?: number | null
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean | null
          op?: string
          qty_per_reference_output?: number | null
          remarks?: string | null
          sku_id?: number
          stock_item_id?: number
          uom_id?: number | null
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_sku_plm_override_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_tpl_header: {
        Row: {
          code: string
          id: number
          process_loss_pct: number
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Insert: {
          code: string
          id?: number
          process_loss_pct?: number
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Update: {
          code?: string
          id?: number
          process_loss_pct?: number
          reference_output_qty?: number
          reference_output_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_tpl_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          qty_per_reference_output: number
          remarks: string | null
          stock_item_id: number
          tpl_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          qty_per_reference_output: number
          remarks?: string | null
          stock_item_id: number
          tpl_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          qty_per_reference_output?: number
          remarks?: string | null
          stock_item_id?: number
          tpl_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "plm_tpl_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_line_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "v_pack_format_picker"
            referencedColumns: ["tpl_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_tpl_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      product_group_kinds: {
        Row: {
          code: string | null
          created_at: string
          group_name: string
          id: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          group_name: string
          id?: number
        }
        Update: {
          code?: string | null
          created_at?: string
          group_name?: string
          id?: number
        }
        Relationships: []
      }
      product_groups: {
        Row: {
          group_name: string
          id: number
          kind_id: number
          sub_category_id: number
        }
        Insert: {
          group_name: string
          id?: number
          kind_id: number
          sub_category_id: number
        }
        Update: {
          group_name?: string
          id?: number
          kind_id?: number
          sub_category_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "product_group_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "product_groups_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_category"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "product_groups_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "product_groups_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sub_category_id"]
          },
        ]
      }
      product_llt_upload: {
        Row: {
          lead_time_months: number
          product_name: string
        }
        Insert: {
          lead_time_months: number
          product_name: string
        }
        Update: {
          lead_time_months?: number
          product_name?: string
        }
        Relationships: []
      }
      product_references: {
        Row: {
          chapter: string
          id: number
          pn: number
          product_id: number
          reference_nature: string
          text_id: number
        }
        Insert: {
          chapter: string
          id?: number
          pn: number
          product_id: number
          reference_nature: string
          text_id: number
        }
        Update: {
          chapter?: string
          id?: number
          pn?: number
          product_id?: number
          reference_nature?: string
          text_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_text_chapter"
            columns: ["text_id", "chapter"]
            isOneToOne: false
            referencedRelation: "text_chapters"
            referencedColumns: ["text_id", "chapter_name"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "publication_details"
            referencedColumns: ["id"]
          },
        ]
      }
      product_season_override: {
        Row: {
          product_id: number
          region_id: number
          season_profile_id: number | null
        }
        Insert: {
          product_id: number
          region_id: number
          season_profile_id?: number | null
        }
        Update: {
          product_id?: number
          region_id?: number
          season_profile_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_season_override_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_season_override_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_season_override_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_season_override_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_season_override_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_season_override_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
        ]
      }
      product_skus: {
        Row: {
          id: number
          is_active: boolean
          pack_size: number
          product_id: number
          uom: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          pack_size: number
          product_id: number
          uom: string
        }
        Update: {
          id?: number
          is_active?: boolean
          pack_size?: number
          product_id?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_batch_overrides: {
        Row: {
          batch_size: number
          bn: string
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          month_start: string
          note: string | null
          op_type: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty: number | null
          product_id: number
          uom: string
          updated_at: string
        }
        Insert: {
          batch_size: number
          bn: string
          created_at?: string
          created_by?: string | null
          id?: number
          is_active?: boolean
          month_start: string
          note?: string | null
          op_type: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty?: number | null
          product_id: number
          uom: string
          updated_at?: string
        }
        Update: {
          batch_size?: number
          bn?: string
          created_at?: string
          created_by?: string | null
          id?: number
          is_active?: boolean
          month_start?: string
          note?: string | null
          op_type?: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty?: number | null
          product_id?: number
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_details"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_batch_sizes"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_batch_overrides_staging: {
        Row: {
          batch_size: number
          bn: string
          id: number
          month_start: string
          note: string | null
          op_type: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty: number | null
          product_id: number
          uom: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          batch_size: number
          bn: string
          id?: number
          month_start: string
          note?: string | null
          op_type: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty?: number | null
          product_id: number
          uom: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          batch_size?: number
          bn?: string
          id?: number
          month_start?: string
          note?: string | null
          op_type?: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty?: number | null
          product_id?: number
          uom?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stage_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_stage_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_details"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_stage_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_batch_sizes"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_stage_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_staging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_batch_size_ref: {
        Row: {
          created_at: string
          effective_from: string
          id: number
          is_active: boolean
          max_batch_size: number | null
          min_batch_size: number | null
          notes: string | null
          preferred_batch_size: number
          product_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: number
          is_active?: boolean
          max_batch_size?: number | null
          min_batch_size?: number | null
          notes?: string | null
          preferred_batch_size: number
          product_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: number
          is_active?: boolean
          max_batch_size?: number | null
          min_batch_size?: number | null
          notes?: string | null
          preferred_batch_size?: number
          product_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_size_ref_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_overrides_staging: {
        Row: {
          delta_qty: number | null
          delta_units: number | null
          id: number
          month_start: string
          note: string | null
          product_id: number
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          delta_qty?: number | null
          delta_units?: number | null
          id?: number
          month_start: string
          note?: string | null
          product_id: number
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          delta_qty?: number | null
          delta_units?: number | null
          id?: number
          month_start?: string
          note?: string | null
          product_id?: number
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pos_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_qty_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          delta_units: number
          id: number
          is_active: boolean
          month_start: string
          product_id: number
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta_units: number
          id?: number
          is_active?: boolean
          month_start: string
          product_id: number
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta_units?: number
          id?: number
          is_active?: boolean
          month_start?: string
          product_id?: number
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_pqo_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          conversion_to_base: number | null
          id: number
          is_llt: boolean | null
          is_pto: boolean
          is_seasonal: boolean | null
          item: string
          malayalam_name: string | null
          manufacture_lead_time_months: number | null
          season_profile_id: number | null
          status: string
          sub_group_id: number
          uom_base: string | null
        }
        Insert: {
          conversion_to_base?: number | null
          id?: number
          is_llt?: boolean | null
          is_pto?: boolean
          is_seasonal?: boolean | null
          item: string
          malayalam_name?: string | null
          manufacture_lead_time_months?: number | null
          season_profile_id?: number | null
          status: string
          sub_group_id: number
          uom_base?: string | null
        }
        Update: {
          conversion_to_base?: number | null
          id?: number
          is_llt?: boolean | null
          is_pto?: boolean
          is_seasonal?: boolean | null
          item?: string
          malayalam_name?: string | null
          manufacture_lead_time_months?: number | null
          season_profile_id?: number | null
          status?: string
          sub_group_id?: number
          uom_base?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
          {
            foreignKeyName: "products_sub_group_id_fkey"
            columns: ["sub_group_id"]
            isOneToOne: false
            referencedRelation: "sub_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_group_id_fkey"
            columns: ["sub_group_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["sub_group_id"]
          },
          {
            foreignKeyName: "products_sub_group_id_fkey"
            columns: ["sub_group_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["sub_group_id"]
          },
          {
            foreignKeyName: "products_sub_group_id_fkey"
            columns: ["sub_group_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sub_group_id"]
          },
        ]
      }
      profiles: {
        Row: {
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      publication_details: {
        Row: {
          commentator: string
          id: number
          publisher: string
          text_name: string
          year_of_publication: number
        }
        Insert: {
          commentator: string
          id?: number
          publisher: string
          text_name: string
          year_of_publication: number
        }
        Update: {
          commentator?: string
          id?: number
          publisher?: string
          text_name?: string
          year_of_publication?: number
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          id: number
          name: string
        }
        Insert: {
          code: string
          id?: number
          name: string
        }
        Update: {
          code?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      rm_bom_header: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          last_updated_at: string
          last_updated_by: string | null
          notes: string | null
          process_loss_pct: number | null
          product_id: number
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          process_loss_pct?: number | null
          product_id: number
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          last_updated_at?: string
          last_updated_by?: string | null
          notes?: string | null
          process_loss_pct?: number | null
          product_id?: number
          reference_output_qty?: number
          reference_output_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      rm_bom_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          qty_per_reference_output: number
          remarks: string | null
          rm_bom_id: number
          stock_item_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          qty_per_reference_output: number
          remarks?: string | null
          rm_bom_id: number
          stock_item_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          qty_per_reference_output?: number
          remarks?: string | null
          rm_bom_id?: number
          stock_item_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rm_bom_line_rm_bom_id_fkey"
            columns: ["rm_bom_id"]
            isOneToOne: false
            referencedRelation: "rm_bom_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_rm_bom_id_fkey"
            columns: ["rm_bom_id"]
            isOneToOne: false
            referencedRelation: "v_batch_rm_requirement"
            referencedColumns: ["rm_bom_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      season_profile: {
        Row: {
          entity_kind: string
          id: number
          label: string
          notes: string | null
        }
        Insert: {
          entity_kind: string
          id?: number
          label: string
          notes?: string | null
        }
        Update: {
          entity_kind?: string
          id?: number
          label?: string
          notes?: string | null
        }
        Relationships: []
      }
      season_profile_month: {
        Row: {
          is_active: boolean
          month_num: number
          season_profile_id: number
        }
        Insert: {
          is_active?: boolean
          month_num: number
          season_profile_id: number
        }
        Update: {
          is_active?: boolean
          month_num?: number
          season_profile_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_profile_month_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_profile_month_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
        ]
      }
      season_profile_weight: {
        Row: {
          month_num: number
          season_profile_id: number
          weight: number
        }
        Insert: {
          month_num: number
          season_profile_id: number
          weight: number
        }
        Update: {
          month_num?: number
          season_profile_id?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_profile_weight_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_profile_weight_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
        ]
      }
      sections: {
        Row: {
          id: number
          section_name: string
        }
        Insert: {
          id?: number
          section_name: string
        }
        Update: {
          id?: number
          section_name?: string
        }
        Relationships: []
      }
      sku_aliases: {
        Row: {
          alias_key: string
          alias_text: string
          created_at: string | null
          note: string | null
          sku_id: number
        }
        Insert: {
          alias_key?: string
          alias_text: string
          created_at?: string | null
          note?: string | null
          sku_id: number
        }
        Update: {
          alias_key?: string
          alias_text?: string
          created_at?: string | null
          note?: string | null
          sku_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      sku_forecast_monthly_base: {
        Row: {
          godown_id: number
          model_key: string
          month_start: string
          region_id: number
          run_id: number
          sku_id: number
          y_hat: number
        }
        Insert: {
          godown_id: number
          model_key: string
          month_start: string
          region_id: number
          run_id: number
          sku_id: number
          y_hat: number
        }
        Update: {
          godown_id?: number
          model_key?: string
          month_start?: string
          region_id?: number
          run_id?: number
          sku_id?: number
          y_hat?: number
        }
        Relationships: [
          {
            foreignKeyName: "sku_forecast_monthly_base_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_forecast_monthly_base_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_forecast_runs_recent"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_forecast_monthly_llt: {
        Row: {
          godown_id: number
          month_start: string
          region_id: number
          run_id: number | null
          sku_id: number
          y_supply: number
        }
        Insert: {
          godown_id: number
          month_start: string
          region_id: number
          run_id?: number | null
          sku_id: number
          y_supply: number
        }
        Update: {
          godown_id?: number
          month_start?: string
          region_id?: number
          run_id?: number | null
          sku_id?: number
          y_supply?: number
        }
        Relationships: [
          {
            foreignKeyName: "sku_forecast_monthly_llt_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_forecast_monthly_llt_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_forecast_runs_recent"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_forecast_monthly_seasonal: {
        Row: {
          godown_id: number
          month_start: string
          region_id: number
          run_id: number | null
          sku_id: number
          y_supply: number
        }
        Insert: {
          godown_id: number
          month_start: string
          region_id: number
          run_id?: number | null
          sku_id: number
          y_supply: number
        }
        Update: {
          godown_id?: number
          month_start?: string
          region_id?: number
          run_id?: number | null
          sku_id?: number
          y_supply?: number
        }
        Relationships: [
          {
            foreignKeyName: "sku_forecast_monthly_seasonal_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_forecast_monthly_seasonal_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_forecast_runs_recent"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_prices: {
        Row: {
          calc_mode: string
          mrp_ik: number
          mrp_ok: number
          ok_pct: number
          sku_id: number
          updated_at: string
        }
        Insert: {
          calc_mode?: string
          mrp_ik: number
          mrp_ok: number
          ok_pct?: number
          sku_id: number
          updated_at?: string
        }
        Update: {
          calc_mode?: string
          mrp_ik?: number
          mrp_ok?: number
          ok_pct?: number
          sku_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      sku_stock_snapshot: {
        Row: {
          as_of_date: string
          godown_id: number
          qty_units: number
          sku_id: number
          stock_rate: number | null
          stock_value: number | null
        }
        Insert: {
          as_of_date: string
          godown_id: number
          qty_units: number
          sku_id: number
          stock_rate?: number | null
          stock_value?: number | null
        }
        Update: {
          as_of_date?: string
          godown_id?: number
          qty_units?: number
          sku_id?: number
          stock_rate?: number | null
          stock_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      sop_approval_roles: {
        Row: {
          department: string | null
          id: string
          name: string
          required: boolean | null
        }
        Insert: {
          department?: string | null
          id?: string
          name: string
          required?: boolean | null
        }
        Update: {
          department?: string | null
          id?: string
          name?: string
          required?: boolean | null
        }
        Relationships: []
      }
      sop_approvals: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          comments: string | null
          deadline: string | null
          id: string
          revision_id: string
          role_id: string
          status: Database["public"]["Enums"]["approval_status"] | null
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          deadline?: string | null
          id?: string
          revision_id: string
          role_id: string
          status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          deadline?: string | null
          id?: string
          revision_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_approvals_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_approvals_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_approvals_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_approvals_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "sop_approval_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          revision_id: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          revision_id: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          revision_id?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_attachments_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_attachments_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_attachments_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      sop_events: {
        Row: {
          action: string
          actor: string | null
          at: string | null
          details: Json | null
          entity: string
          entity_id: string
          id: number
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string | null
          details?: Json | null
          entity: string
          entity_id: string
          id?: number
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string
          id?: number
        }
        Relationships: []
      }
      sop_master: {
        Row: {
          activity_kind_id: string | null
          created_at: string | null
          created_by: string | null
          current_status: Database["public"]["Enums"]["sop_status"] | null
          description: string | null
          id: string
          product_group_code: string | null
          product_group_kind_id: number | null
          review_policy_code: string | null
          seq: number
          series_code: string
          sop_code: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          activity_kind_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["sop_status"] | null
          description?: string | null
          id?: string
          product_group_code?: string | null
          product_group_kind_id?: number | null
          review_policy_code?: string | null
          seq: number
          series_code: string
          sop_code?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          activity_kind_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["sop_status"] | null
          description?: string | null
          id?: string
          product_group_code?: string | null
          product_group_kind_id?: number | null
          review_policy_code?: string | null
          seq?: number
          series_code?: string
          sop_code?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_master_activity_kind_id_fkey"
            columns: ["activity_kind_id"]
            isOneToOne: false
            referencedRelation: "activity_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_master_product_group_kind_id_fkey"
            columns: ["product_group_kind_id"]
            isOneToOne: false
            referencedRelation: "product_group_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_master_review_policy_code_fkey"
            columns: ["review_policy_code"]
            isOneToOne: false
            referencedRelation: "sop_review_policies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sop_master_series_code_fkey"
            columns: ["series_code"]
            isOneToOne: false
            referencedRelation: "sop_series"
            referencedColumns: ["code"]
          },
        ]
      }
      sop_review_policies: {
        Row: {
          code: string
          months_interval: number | null
          name: string
        }
        Insert: {
          code: string
          months_interval?: number | null
          name: string
        }
        Update: {
          code?: string
          months_interval?: number | null
          name?: string
        }
        Relationships: []
      }
      sop_review_reminders: {
        Row: {
          completed: boolean | null
          due_date: string
          id: string
          notified_at: string | null
          revision_id: string | null
          sop_id: string | null
        }
        Insert: {
          completed?: boolean | null
          due_date: string
          id?: string
          notified_at?: string | null
          revision_id?: string | null
          sop_id?: string | null
        }
        Update: {
          completed?: boolean | null
          due_date?: string
          id?: string
          notified_at?: string | null
          revision_id?: string | null
          sop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_review_reminders_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_review_reminders_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_review_reminders_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_review_reminders_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sop_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_review_reminders_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_review_reminders_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["sop_id"]
          },
        ]
      }
      sop_revisions: {
        Row: {
          change_summary: string | null
          change_type: Database["public"]["Enums"]["sop_change_type"]
          created_at: string | null
          draft_date: string | null
          effective_date: string | null
          id: string
          next_review_date: string | null
          review_start_date: string | null
          sop_id: string
          status: Database["public"]["Enums"]["sop_status"]
          superseded_by_id: string | null
          updated_at: string | null
          version_major: number | null
          version_minor: number | null
          version_text: string | null
        }
        Insert: {
          change_summary?: string | null
          change_type: Database["public"]["Enums"]["sop_change_type"]
          created_at?: string | null
          draft_date?: string | null
          effective_date?: string | null
          id?: string
          next_review_date?: string | null
          review_start_date?: string | null
          sop_id: string
          status?: Database["public"]["Enums"]["sop_status"]
          superseded_by_id?: string | null
          updated_at?: string | null
          version_major?: number | null
          version_minor?: number | null
          version_text?: string | null
        }
        Update: {
          change_summary?: string | null
          change_type?: Database["public"]["Enums"]["sop_change_type"]
          created_at?: string | null
          draft_date?: string | null
          effective_date?: string | null
          id?: string
          next_review_date?: string | null
          review_start_date?: string | null
          sop_id?: string
          status?: Database["public"]["Enums"]["sop_status"]
          superseded_by_id?: string | null
          updated_at?: string | null
          version_major?: number | null
          version_minor?: number | null
          version_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_revisions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sop_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_revisions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_revisions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["sop_id"]
          },
          {
            foreignKeyName: "sop_revisions_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "sop_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_revisions_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_revisions_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      sop_sections: {
        Row: {
          content: string
          id: string
          position: number
          revision_id: string
          section_number: string
          title: string
        }
        Insert: {
          content: string
          id?: string
          position: number
          revision_id: string
          section_number: string
          title: string
        }
        Update: {
          content?: string
          id?: string
          position?: number
          revision_id?: string
          section_number?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_sections_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_sections_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "sop_v_active"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "sop_sections_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "v_sop_flat"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      sop_series: {
        Row: {
          code: string
          description: string | null
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      sop_series_counters: {
        Row: {
          next_seq: number
          series_code: string
        }
        Insert: {
          next_seq?: number
          series_code: string
        }
        Update: {
          next_seq?: number
          series_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_series_counters_series_code_fkey"
            columns: ["series_code"]
            isOneToOne: true
            referencedRelation: "sop_series"
            referencedColumns: ["code"]
          },
        ]
      }
      sp_bom_header: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          last_updated_at: string | null
          last_updated_by: string | null
          notes: string | null
          owner_item_id: number
          process_loss_pct: number | null
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          last_updated_at?: string | null
          last_updated_by?: string | null
          notes?: string | null
          owner_item_id: number
          process_loss_pct?: number | null
          reference_output_qty: number
          reference_output_uom_id: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          last_updated_at?: string | null
          last_updated_by?: string | null
          notes?: string | null
          owner_item_id?: number
          process_loss_pct?: number | null
          reference_output_qty?: number
          reference_output_uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_owner_item_id_fkey"
            columns: ["owner_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "sp_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_bom_line: {
        Row: {
          id: number
          is_optional: boolean
          line_no: number
          qty_per_reference_output: number
          remarks: string | null
          sp_bom_id: number
          stock_item_id: number
          uom_id: number
          wastage_pct: number | null
        }
        Insert: {
          id?: number
          is_optional?: boolean
          line_no: number
          qty_per_reference_output: number
          remarks?: string | null
          sp_bom_id: number
          stock_item_id: number
          uom_id: number
          wastage_pct?: number | null
        }
        Update: {
          id?: number
          is_optional?: boolean
          line_no?: number
          qty_per_reference_output?: number
          remarks?: string | null
          sp_bom_id?: number
          stock_item_id?: number
          uom_id?: number
          wastage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_bom_line_sp_bom_id_fkey"
            columns: ["sp_bom_id"]
            isOneToOne: false
            referencedRelation: "sp_bom_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "sp_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "sp_bom_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_cleanup_queue: {
        Row: {
          bucket: string
          deleted_at: string | null
          enqueued_at: string
          id: number
          job_id: string | null
          key: string
        }
        Insert: {
          bucket?: string
          deleted_at?: string | null
          enqueued_at?: string
          id?: number
          job_id?: string | null
          key: string
        }
        Update: {
          bucket?: string
          deleted_at?: string | null
          enqueued_at?: string
          id?: number
          job_id?: string | null
          key?: string
        }
        Relationships: []
      }
      sub_categories: {
        Row: {
          category_id: number
          id: number
          subcategory_name: string
        }
        Insert: {
          category_id: number
          id?: number
          subcategory_name: string
        }
        Update: {
          category_id?: number
          id?: number
          subcategory_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["category_id"]
          },
        ]
      }
      sub_groups: {
        Row: {
          id: number
          product_group_id: number
          sub_group_name: string
        }
        Insert: {
          id?: number
          product_group_id: number
          sub_group_name: string
        }
        Update: {
          id?: number
          product_group_id?: number
          sub_group_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_groups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_groups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_group_id"]
          },
          {
            foreignKeyName: "sub_groups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_godown_group"
            referencedColumns: ["product_group_id"]
          },
          {
            foreignKeyName: "sub_groups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["product_group_id"]
          },
          {
            foreignKeyName: "sub_groups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_group_id"]
          },
        ]
      }
      subsections: {
        Row: {
          id: number
          section_id: number
          subsection_name: string
        }
        Insert: {
          id?: number
          section_id: number
          subsection_name: string
        }
        Update: {
          id?: number
          section_id?: number
          subsection_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_rollup_refresh_queue: {
        Row: {
          id: number
          last_requested: string | null
          last_run: string | null
        }
        Insert: {
          id?: number
          last_requested?: string | null
          last_run?: string | null
        }
        Update: {
          id?: number
          last_requested?: string | null
          last_run?: string | null
        }
        Relationships: []
      }
      tally_consumables_monthly_snapshot: {
        Row: {
          fy_start_date: string
          group_name: string | null
          id: number
          in_qty_value: number | null
          inserted_at: string
          month_label: string
          month_start_date: string
          out_qty_value: number | null
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          fy_start_date: string
          group_name?: string | null
          id?: number
          in_qty_value?: number | null
          inserted_at?: string
          month_label: string
          month_start_date: string
          out_qty_value?: number | null
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          fy_start_date?: string
          group_name?: string | null
          id?: number
          in_qty_value?: number | null
          inserted_at?: string
          month_label?: string
          month_start_date?: string
          out_qty_value?: number | null
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_consumables_stock_snapshot: {
        Row: {
          as_of_date: string
          id: number
          inserted_at: string | null
          qty_value: number
          rate_value: number | null
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          id?: number
          inserted_at?: string | null
          qty_value: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          id?: number
          inserted_at?: string | null
          qty_value?: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_expenses_snapshot: {
        Row: {
          as_of_date: string
          credit_amount_value: number | null
          debit_amount_value: number | null
          expense_group: string
          head_name: string
          id: number
          inserted_at: string | null
          net_cb_value: number | null
          source_key: string | null
        }
        Insert: {
          as_of_date: string
          credit_amount_value?: number | null
          debit_amount_value?: number | null
          expense_group: string
          head_name: string
          id?: number
          inserted_at?: string | null
          net_cb_value?: number | null
          source_key?: string | null
        }
        Update: {
          as_of_date?: string
          credit_amount_value?: number | null
          debit_amount_value?: number | null
          expense_group?: string
          head_name?: string
          id?: number
          inserted_at?: string | null
          net_cb_value?: number | null
          source_key?: string | null
        }
        Relationships: []
      }
      tally_fg_transfer_snapshot: {
        Row: {
          as_of_date: string
          batch_code: string
          godown_breakdown: Json
          id: number
          inserted_at: string | null
          item_name: string
          qty_unit_text: string | null
          qty_value: number
          raw_godown: string | null
          source_key: string | null
          transfer_date: string
          transfer_store: string
        }
        Insert: {
          as_of_date: string
          batch_code: string
          godown_breakdown?: Json
          id?: number
          inserted_at?: string | null
          item_name: string
          qty_unit_text?: string | null
          qty_value: number
          raw_godown?: string | null
          source_key?: string | null
          transfer_date: string
          transfer_store: string
        }
        Update: {
          as_of_date?: string
          batch_code?: string
          godown_breakdown?: Json
          id?: number
          inserted_at?: string | null
          item_name?: string
          qty_unit_text?: string | null
          qty_value?: number
          raw_godown?: string | null
          source_key?: string | null
          transfer_date?: string
          transfer_store?: string
        }
        Relationships: []
      }
      tally_fuel_stock_snapshot: {
        Row: {
          as_of_date: string
          id: number
          inserted_at: string | null
          qty_value: number
          rate_value: number | null
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          id?: number
          inserted_at?: string | null
          qty_value: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          id?: number
          inserted_at?: string | null
          qty_value?: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_group_outstanding_snapshot: {
        Row: {
          as_of_date: string
          bill_date_text: string | null
          bill_ref: string
          group_name: string
          id: number
          inserted_at: string | null
          opening_amount_value: number | null
          outstanding_amount_value: number | null
          source_key: string | null
          vendor_name: string
        }
        Insert: {
          as_of_date: string
          bill_date_text?: string | null
          bill_ref: string
          group_name: string
          id?: number
          inserted_at?: string | null
          opening_amount_value?: number | null
          outstanding_amount_value?: number | null
          source_key?: string | null
          vendor_name: string
        }
        Update: {
          as_of_date?: string
          bill_date_text?: string | null
          bill_ref?: string
          group_name?: string
          id?: number
          inserted_at?: string | null
          opening_amount_value?: number | null
          outstanding_amount_value?: number | null
          source_key?: string | null
          vendor_name?: string
        }
        Relationships: []
      }
      tally_monthly_group_summary: {
        Row: {
          as_of_date: string
          credit_amount_value: number
          debit_amount_value: number
          fy_month_index: number | null
          id: number
          inserted_at: string | null
          period_label: string
          source_key: string | null
          tally_group: string
        }
        Insert: {
          as_of_date: string
          credit_amount_value?: number
          debit_amount_value?: number
          fy_month_index?: number | null
          id?: number
          inserted_at?: string | null
          period_label: string
          source_key?: string | null
          tally_group: string
        }
        Update: {
          as_of_date?: string
          credit_amount_value?: number
          debit_amount_value?: number
          fy_month_index?: number | null
          id?: number
          inserted_at?: string | null
          period_label?: string
          source_key?: string | null
          tally_group?: string
        }
        Relationships: []
      }
      tally_plm_stock_snapshot: {
        Row: {
          as_of_date: string
          id: number
          inserted_at: string | null
          qty_value: number
          rate_value: number | null
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          id?: number
          inserted_at?: string | null
          qty_value: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          id?: number
          inserted_at?: string | null
          qty_value?: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_purchase_orders_snapshot: {
        Row: {
          as_of_date: string
          estimate_value: number | null
          id: number
          inserted_at: string | null
          order_date_text: string | null
          order_no: string
          pending_qty_value: number
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          estimate_value?: number | null
          id?: number
          inserted_at?: string | null
          order_date_text?: string | null
          order_no: string
          pending_qty_value: number
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          estimate_value?: number | null
          id?: number
          inserted_at?: string | null
          order_date_text?: string | null
          order_no?: string
          pending_qty_value?: number
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_purchases_vreg_snapshot: {
        Row: {
          act_qty_abs: number
          act_qty_value: number
          avg_rate_value: number | null
          bill_qty_abs: number
          bill_qty_value: number
          billed_amount_abs: number
          billed_amount_value: number
          canonical_qty_value: number
          godown_label: string
          inserted_at: string
          line_count: number
          parser_settings: Json
          parser_version: string
          source_desc: string
          source_key: string
          supplier_name: string
          tally_item_name: string
          voucher_date: string
        }
        Insert: {
          act_qty_abs: number
          act_qty_value: number
          avg_rate_value?: number | null
          bill_qty_abs: number
          bill_qty_value: number
          billed_amount_abs: number
          billed_amount_value: number
          canonical_qty_value: number
          godown_label: string
          inserted_at?: string
          line_count: number
          parser_settings: Json
          parser_version: string
          source_desc: string
          source_key: string
          supplier_name: string
          tally_item_name: string
          voucher_date: string
        }
        Update: {
          act_qty_abs?: number
          act_qty_value?: number
          avg_rate_value?: number | null
          bill_qty_abs?: number
          bill_qty_value?: number
          billed_amount_abs?: number
          billed_amount_value?: number
          canonical_qty_value?: number
          godown_label?: string
          inserted_at?: string
          line_count?: number
          parser_settings?: Json
          parser_version?: string
          source_desc?: string
          source_key?: string
          supplier_name?: string
          tally_item_name?: string
          voucher_date?: string
        }
        Relationships: []
      }
      tally_rm_inward_qty_snapshot: {
        Row: {
          as_of_date: string
          id: number
          inserted_at: string | null
          inward_qty_value: number
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          id?: number
          inserted_at?: string | null
          inward_qty_value: number
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          id?: number
          inserted_at?: string | null
          inward_qty_value?: number
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_rm_pm_issues_snapshot: {
        Row: {
          bom_name: string | null
          entry_mode: string | null
          extraction_note: string | null
          fg_batch_no: string | null
          fg_batch_size_qty: number | null
          id: number
          inserted_at: string
          issue_type: string
          material_item_name: string
          material_qty_value: number
          material_uom: string | null
          narration_text: string | null
          parent_count: number | null
          product_name: string | null
          source_key: string | null
          voucher_date: string
          voucher_number: string | null
        }
        Insert: {
          bom_name?: string | null
          entry_mode?: string | null
          extraction_note?: string | null
          fg_batch_no?: string | null
          fg_batch_size_qty?: number | null
          id?: number
          inserted_at?: string
          issue_type: string
          material_item_name: string
          material_qty_value: number
          material_uom?: string | null
          narration_text?: string | null
          parent_count?: number | null
          product_name?: string | null
          source_key?: string | null
          voucher_date: string
          voucher_number?: string | null
        }
        Update: {
          bom_name?: string | null
          entry_mode?: string | null
          extraction_note?: string | null
          fg_batch_no?: string | null
          fg_batch_size_qty?: number | null
          id?: number
          inserted_at?: string
          issue_type?: string
          material_item_name?: string
          material_qty_value?: number
          material_uom?: string | null
          narration_text?: string | null
          parent_count?: number | null
          product_name?: string | null
          source_key?: string | null
          voucher_date?: string
          voucher_number?: string | null
        }
        Relationships: []
      }
      tally_rm_stock_snapshot: {
        Row: {
          as_of_date: string
          id: number
          inserted_at: string | null
          qty_value: number
          rate_value: number | null
          source_key: string | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          id?: number
          inserted_at?: string | null
          qty_value: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          id?: number
          inserted_at?: string | null
          qty_value?: number
          rate_value?: number | null
          source_key?: string | null
          tally_item_name?: string
        }
        Relationships: []
      }
      tally_sales_vreg_snapshot: {
        Row: {
          act_qty_value: number | null
          bill_qty_value: number | null
          billed_amount_abs: number | null
          billed_amount_value: number | null
          canonical_qty_value: number | null
          godown_label: string
          id: number
          inserted_at: string
          parser_settings: Json | null
          parser_version: string | null
          source_desc: string | null
          source_key: string | null
          tally_item_name: string
          voucher_date: string
        }
        Insert: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          billed_amount_abs?: number | null
          billed_amount_value?: number | null
          canonical_qty_value?: number | null
          godown_label: string
          id?: number
          inserted_at?: string
          parser_settings?: Json | null
          parser_version?: string | null
          source_desc?: string | null
          source_key?: string | null
          tally_item_name: string
          voucher_date: string
        }
        Update: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          billed_amount_abs?: number | null
          billed_amount_value?: number | null
          canonical_qty_value?: number | null
          godown_label?: string
          id?: number
          inserted_at?: string
          parser_settings?: Json | null
          parser_version?: string | null
          source_desc?: string | null
          source_key?: string | null
          tally_item_name?: string
          voucher_date?: string
        }
        Relationships: []
      }
      tally_sales_vreg_snapshot_backup_all: {
        Row: {
          act_qty_value: number | null
          bill_qty_value: number | null
          billed_amount_abs: number | null
          billed_amount_value: number | null
          canonical_qty_value: number | null
          godown_label: string
          id: number
          inserted_at: string
          parser_settings: Json | null
          parser_version: string | null
          source_desc: string | null
          source_key: string | null
          tally_item_name: string
          voucher_date: string
        }
        Insert: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          billed_amount_abs?: number | null
          billed_amount_value?: number | null
          canonical_qty_value?: number | null
          godown_label: string
          id?: number
          inserted_at?: string
          parser_settings?: Json | null
          parser_version?: string | null
          source_desc?: string | null
          source_key?: string | null
          tally_item_name: string
          voucher_date: string
        }
        Update: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          billed_amount_abs?: number | null
          billed_amount_value?: number | null
          canonical_qty_value?: number | null
          godown_label?: string
          id?: number
          inserted_at?: string
          parser_settings?: Json | null
          parser_version?: string | null
          source_desc?: string | null
          source_key?: string | null
          tally_item_name?: string
          voucher_date?: string
        }
        Relationships: []
      }
      tally_stock_by_name: {
        Row: {
          as_of_date: string
          godown_label: string
          id: number
          inserted_at: string | null
          qty_units: number
          source_key: string | null
          stock_rate: number | null
          stock_value: number | null
          tally_item_name: string
        }
        Insert: {
          as_of_date: string
          godown_label: string
          id?: number
          inserted_at?: string | null
          qty_units: number
          source_key?: string | null
          stock_rate?: number | null
          stock_value?: number | null
          tally_item_name: string
        }
        Update: {
          as_of_date?: string
          godown_label?: string
          id?: number
          inserted_at?: string | null
          qty_units?: number
          source_key?: string | null
          stock_rate?: number | null
          stock_value?: number | null
          tally_item_name?: string
        }
        Relationships: []
      }
      text_chapters: {
        Row: {
          chapter_name: string
          id: number
          text_id: number
        }
        Insert: {
          chapter_name: string
          id?: number
          text_id: number
        }
        Update: {
          chapter_name?: string
          id?: number
          text_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "publication_details"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          module_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          module_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions_canonical: {
        Row: {
          can_edit: boolean
          can_view: boolean
          meta: Json | null
          target: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          meta?: Json | null
          target: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          meta?: Json | null
          target?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_upc_target"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "permission_targets"
            referencedColumns: ["key"]
          },
        ]
      }
      user_permissions_canonical_backup_20260126: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          meta: Json | null
          target: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          meta?: Json | null
          target?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          meta?: Json | null
          target?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          email: string
          last_seen: string
          user_id: string
        }
        Insert: {
          email: string
          last_seen?: string
          user_id: string
        }
        Update: {
          email?: string
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      vreg_sales_baseline: {
        Row: {
          act_qty_value: number | null
          bill_qty_value: number | null
          godown_label: string
          snapshot_ts: string | null
          tally_item_name: string
          voucher_date: string
        }
        Insert: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          godown_label: string
          snapshot_ts?: string | null
          tally_item_name: string
          voucher_date: string
        }
        Update: {
          act_qty_value?: number | null
          bill_qty_value?: number | null
          godown_label?: string
          snapshot_ts?: string | null
          tally_item_name?: string
          voucher_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      bmr_card_not_initiated: {
        Row: {
          batch_size: number | null
          bmr_id: number | null
          bn: string | null
          category: string | null
          created_at: string | null
          item: string | null
          product_group: string | null
          product_id: number | null
          subcategory: string | null
          subgroup: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      bottled_stock_on_hand: {
        Row: {
          batch_number: string | null
          category: string | null
          group: string | null
          item: string | null
          on_hand: number | null
          pack_size: number | null
          sku_id: number | null
          sub_category: string | null
          sub_group: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "event_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      fg_bulk_stock: {
        Row: {
          bn: string | null
          category_name: string | null
          item: string | null
          last_updated: string | null
          on_hand_qty_uom: string | null
          product_group: string | null
          product_id: number | null
          qty_on_hand: number | null
          subcategory: string | null
          subgroup: string | null
        }
        Relationships: []
      }
      mv_bmr_rollup: {
        Row: {
          batches_text: string | null
          cnt: number | null
          product_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      mv_bottled_rollup: {
        Row: {
          batches_text: string | null
          product_id: number | null
          qty_base: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      mv_fg_bulk_rollup: {
        Row: {
          batches_text: string | null
          product_id: number | null
          qty_base: number | null
        }
        Relationships: []
      }
      mv_forecast_plan_12m: {
        Row: {
          demand_baseline: number | null
          godown_id: number | null
          month_start: string | null
          region_id: number | null
          sku_id: number | null
          supply_final: number | null
          supply_llt: number | null
          supply_seasonal: number | null
        }
        Relationships: []
      }
      mv_system_plan_monthly: {
        Row: {
          month_start: string | null
          product_id: number | null
          system_qty: number | null
        }
        Relationships: []
      }
      mv_wip_rollup: {
        Row: {
          batches_text: string | null
          product_id: number | null
          qty_base: number | null
        }
        Relationships: []
      }
      sales_monthly: {
        Row: {
          billed_amount: number | null
          godown_id: number | null
          month_start: string | null
          product_id: number | null
          qty_billed: number | null
          qty_units: number | null
          region_id: number | null
          sku_id: number | null
          source_max_inserted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      sop_v_active: {
        Row: {
          activity_kind_id: string | null
          created_at: string | null
          created_by: string | null
          current_status: Database["public"]["Enums"]["sop_status"] | null
          description: string | null
          effective_date: string | null
          id: string | null
          next_review_date: string | null
          product_group_code: string | null
          product_group_kind_id: number | null
          review_policy_code: string | null
          revision_id: string | null
          seq: number | null
          series_code: string | null
          sop_code: string | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
          version_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_master_activity_kind_id_fkey"
            columns: ["activity_kind_id"]
            isOneToOne: false
            referencedRelation: "activity_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_master_product_group_kind_id_fkey"
            columns: ["product_group_kind_id"]
            isOneToOne: false
            referencedRelation: "product_group_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_master_review_policy_code_fkey"
            columns: ["review_policy_code"]
            isOneToOne: false
            referencedRelation: "sop_review_policies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sop_master_series_code_fkey"
            columns: ["series_code"]
            isOneToOne: false
            referencedRelation: "sop_series"
            referencedColumns: ["code"]
          },
        ]
      }
      v_baseline_effective_12m: {
        Row: {
          baseline_run_id: number | null
          delta_units: number | null
          demand_baseline: number | null
          demand_baseline_effective: number | null
          godown_id: number | null
          month_start: string | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_forecast_monthly_base_run_id_fkey"
            columns: ["baseline_run_id"]
            isOneToOne: false
            referencedRelation: "forecast_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_forecast_monthly_base_run_id_fkey"
            columns: ["baseline_run_id"]
            isOneToOne: false
            referencedRelation: "v_forecast_runs_recent"
            referencedColumns: ["id"]
          },
        ]
      }
      v_batch_overrides_delta: {
        Row: {
          month_start: string | null
          override_delta_total: number | null
          product_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_batch_overrides_effective: {
        Row: {
          batch_size: number | null
          bn: string | null
          created_at: string | null
          created_by: string | null
          month_start: string | null
          note: string | null
          op_type:
            | Database["public"]["Enums"]["production_batch_op_type"]
            | null
          override_qty: number | null
          product_id: number | null
          uom: string | null
          updated_at: string | null
        }
        Insert: {
          batch_size?: number | null
          bn?: string | null
          created_at?: string | null
          created_by?: string | null
          month_start?: string | null
          note?: string | null
          op_type?:
            | Database["public"]["Enums"]["production_batch_op_type"]
            | null
          override_qty?: number | null
          product_id?: number | null
          uom?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_size?: number | null
          bn?: string | null
          created_at?: string | null
          created_by?: string | null
          month_start?: string | null
          note?: string | null
          op_type?:
            | Database["public"]["Enums"]["production_batch_op_type"]
            | null
          override_qty?: number | null
          product_id?: number | null
          uom?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "bmr_details"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_batch_sizes"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "fk_over_bmr"
            columns: ["product_id", "bn", "batch_size", "uom"]
            isOneToOne: false
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["product_id", "bn", "batch_size", "uom"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batch_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_batch_plan_batches_enriched: {
        Row: {
          batch_id: number | null
          batch_no_seq: number | null
          batch_size: number | null
          header_id: number | null
          item: string | null
          line_id: number | null
          month_start: string | null
          notes: string | null
          product_id: number | null
          source_rule: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_lines_enriched"
            referencedColumns: ["line_id"]
          },
        ]
      }
      v_batch_plan_batches_status: {
        Row: {
          batch_id: number | null
          batch_no_seq: number | null
          batch_size: number | null
          bmr_id: number | null
          bmr_size: number | null
          bmr_uom: string | null
          bn: string | null
          created_at: string | null
          header_id: number | null
          is_wip: boolean | null
          item: string | null
          map_status: string | null
          mapped_bn: string | null
          mapped_size: number | null
          mapped_uom: string | null
          month_start: string | null
          product_id: number | null
          product_name: string | null
          size_delta: number | null
          size_mismatch_label: string | null
          source_rule: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_pm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_requirement"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_rm_pm_issues_clean"
            referencedColumns: ["bmr_id"]
          },
        ]
      }
      v_batch_plan_effective: {
        Row: {
          effective_total: number | null
          month_start: string | null
          overrides_delta: number | null
          planned_total: number | null
          product_id: number | null
        }
        Relationships: []
      }
      v_batch_plan_header: {
        Row: {
          final_make_qty: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          override_qty_sum: number | null
          preferred_batch_size: number | null
          product_id: number | null
          remaining_qty_to_plan: number | null
        }
        Relationships: []
      }
      v_batch_plan_lines_enriched: {
        Row: {
          batch_count: number | null
          final_make_qty: number | null
          header_id: number | null
          item: string | null
          line_id: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          notes: string | null
          preferred_batch_size: number | null
          product_id: number | null
          residual_qty: number | null
          sum_batched: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
        ]
      }
      v_batch_plan_lines_with_impact: {
        Row: {
          batch_count: number | null
          effective_total: number | null
          final_make_qty: number | null
          header_id: number | null
          month_start: string | null
          overrides_delta: number | null
          preferred_batch_size: number | null
          product_id: number | null
          residual_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_lines_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
        ]
      }
      v_batch_plan_mapping: {
        Row: {
          batch_id: number | null
          batch_no_seq: number | null
          batch_size: number | null
          bmr_id: number | null
          header_id: number | null
          is_mapped: boolean | null
          line_id: number | null
          month_start: string | null
          product_id: number | null
          source_rule: string | null
        }
        Insert: {
          batch_id?: number | null
          batch_no_seq?: number | null
          batch_size?: number | null
          bmr_id?: number | null
          header_id?: number | null
          is_mapped?: never
          line_id?: number | null
          month_start?: string | null
          product_id?: number | null
          source_rule?: string | null
        }
        Update: {
          batch_id?: number | null
          batch_no_seq?: number | null
          batch_size?: number | null
          bmr_id?: number | null
          header_id?: number | null
          is_mapped?: never
          line_id?: number | null
          month_start?: string | null
          product_id?: number | null
          source_rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_mapping_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_rollup"
            referencedColumns: ["header_id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "batch_plan_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plan_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_batch_plan_lines_enriched"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_card_not_initiated"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "bmr_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_pm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_requirement"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_batch_rm_usage"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_bmr_with_map_flag"
            referencedColumns: ["bmr_id"]
          },
          {
            foreignKeyName: "fk_bpb_bmr"
            columns: ["bmr_id"]
            isOneToOne: true
            referencedRelation: "v_rm_pm_issues_clean"
            referencedColumns: ["bmr_id"]
          },
        ]
      }
      v_batch_plan_mapping_rollup: {
        Row: {
          batches_mapped: number | null
          batches_total: number | null
          batches_unmapped: number | null
          header_id: number | null
          mapped_pct: string | null
          plan_title: string | null
        }
        Relationships: []
      }
      v_batch_plan_rollup: {
        Row: {
          header_id: number | null
          lines: number | null
          plan_title: string | null
          status: string | null
          total_batched: number | null
          total_residual: number | null
          total_target: number | null
          window_from: string | null
          window_to: string | null
        }
        Relationships: []
      }
      v_batch_pm_usage: {
        Row: {
          bmr_batch_size: number | null
          bmr_batch_uom: string | null
          bmr_bn_original: string | null
          bmr_id: number | null
          bn_norm: string | null
          first_issue_date: string | null
          is_allocation_approx: boolean | null
          last_issue_date: string | null
          line_count: number | null
          material_item_name_raw: string | null
          material_uom_raw: string | null
          product_id: number | null
          product_name: string | null
          qty_issued: number | null
          source_keys: string[] | null
          stock_item_id: number | null
          stock_item_name: string | null
          voucher_numbers: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_batch_rm_requirement: {
        Row: {
          bmr_batch_size: number | null
          bmr_batch_uom: string | null
          bmr_bn: string | null
          bmr_id: number | null
          bn_norm: string | null
          is_optional: boolean | null
          line_no: number | null
          line_uom_code: string | null
          line_uom_id: number | null
          process_loss_pct: number | null
          product_id: number | null
          product_name: string | null
          qty_per_reference_output: number | null
          qty_required_final: number | null
          qty_required_nominal: number | null
          qty_required_with_process_loss: number | null
          reference_output_qty: number | null
          reference_output_uom_code: string | null
          reference_output_uom_id: number | null
          rm_bom_id: number | null
          rm_bom_line_id: number | null
          scale_process_factor: number | null
          scale_qty_factor: number | null
          scale_wastage_factor: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          wastage_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "rm_bom_header_reference_output_uom_id_fkey"
            columns: ["reference_output_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["line_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["line_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "rm_bom_line_uom_id_fkey"
            columns: ["line_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_batch_rm_usage: {
        Row: {
          bmr_batch_size: number | null
          bmr_batch_uom: string | null
          bmr_bn_original: string | null
          bmr_id: number | null
          bn_norm: string | null
          first_issue_date: string | null
          is_allocation_approx: boolean | null
          last_issue_date: string | null
          line_count: number | null
          material_item_name_raw: string | null
          material_uom_raw: string | null
          product_id: number | null
          product_name: string | null
          qty_issued: number | null
          source_keys: string[] | null
          stock_item_id: number | null
          stock_item_name: string | null
          voucher_numbers: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_batch_rm_usage_vs_req: {
        Row: {
          bmr_batch_size: number | null
          bmr_batch_uom: string | null
          bmr_bn: string | null
          bmr_id: number | null
          bn_norm: string | null
          first_issue_date: string | null
          is_allocation_approx: boolean | null
          last_issue_date: string | null
          line_count: number | null
          pct_variance: number | null
          product_id: number | null
          product_name: string | null
          qty_issued: number | null
          qty_required_final: number | null
          qty_required_nominal: number | null
          qty_required_with_process_loss: number | null
          qty_variance: number | null
          source_keys: string[] | null
          stock_item_id: number | null
          stock_item_name: string | null
          voucher_numbers: string[] | null
        }
        Relationships: []
      }
      v_bmr_batch_sizes: {
        Row: {
          batch_size: number | null
          bn: string | null
          product_id: number | null
          uom: string | null
        }
        Insert: {
          batch_size?: number | null
          bn?: string | null
          product_id?: number | null
          uom?: string | null
        }
        Update: {
          batch_size?: number | null
          bn?: string | null
          product_id?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_bmr_with_map_flag: {
        Row: {
          batch_size: number | null
          bmr_id: number | null
          bn: string | null
          is_mapped: boolean | null
          item: string | null
          product_id: number | null
          uom: string | null
        }
        Insert: {
          batch_size?: number | null
          bmr_id?: number | null
          bn?: string | null
          is_mapped?: never
          item?: string | null
          product_id?: number | null
          uom?: string | null
        }
        Update: {
          batch_size?: number | null
          bmr_id?: number | null
          bn?: string | null
          is_mapped?: never
          item?: string | null
          product_id?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_bmr_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_bottled_stock_by_product_base: {
        Row: {
          product_id: number | null
          qty_base: number | null
        }
        Relationships: []
      }
      v_daily_etl_health: {
        Row: {
          agent_last_error: string | null
          agent_last_seen_at: string | null
          agent_ver: string | null
          mapping_missing_godown_rows: number | null
          mapping_missing_sku_rows: number | null
          mapping_pct_resolvable: number | null
          mapping_total_rows: number | null
          snapshot_godowns_with_rows: number | null
          snapshot_rows_today: number | null
        }
        Relationships: []
      }
      v_dwl_fg_transfer_cutoff: {
        Row: {
          cutoff_date: string | null
        }
        Relationships: []
      }
      v_dwl_fg_transfer_event: {
        Row: {
          all_lines_sku_mapped: boolean | null
          any_dwl_id: number | null
          batch_code: string | null
          dwl_row_count: number | null
          is_product_mapped: boolean | null
          log_breakdown_by_skuid: Json | null
          log_breakdown_lines: Json | null
          log_completed_on: string | null
          log_created_at: string | null
          log_date: string | null
          log_status: string | null
          log_total_packs: number | null
          log_uploaded_by: string | null
          product_id: number | null
          product_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_etl_job_types: {
        Row: {
          job_type: string | null
        }
        Relationships: []
      }
      v_etl_recent_detailed: {
        Row: {
          as_of_date: string | null
          company: string | null
          created_at: string | null
          finished_at: string | null
          group_name: string | null
          id: string | null
          job_type: string | null
          params: Json | null
          priority: number | null
          report_key: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          vreg_date: string | null
        }
        Insert: {
          as_of_date?: never
          company?: never
          created_at?: string | null
          finished_at?: string | null
          group_name?: never
          id?: string | null
          job_type?: string | null
          params?: Json | null
          priority?: number | null
          report_key?: never
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          vreg_date?: never
        }
        Update: {
          as_of_date?: never
          company?: never
          created_at?: string | null
          finished_at?: string | null
          group_name?: never
          id?: string | null
          job_type?: string | null
          params?: Json | null
          priority?: number | null
          report_key?: never
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          vreg_date?: never
        }
        Relationships: []
      }
      v_etl_report_keys: {
        Row: {
          job_type: string | null
          report_key: string | null
        }
        Relationships: []
      }
      v_fg_bulk_stock_by_product_base: {
        Row: {
          product_id: number | null
          qty_base: number | null
        }
        Relationships: []
      }
      v_fg_stock_dates: {
        Row: {
          as_of_date: string | null
          rows: number | null
        }
        Relationships: []
      }
      v_fg_stock_latest_by_region_product: {
        Row: {
          as_of_date: string | null
          product_id: number | null
          qty_units: number | null
          region_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_fg_stock_latest_product_region: {
        Row: {
          as_of_date: string | null
          product_id: number | null
          qty_units: number | null
          region_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_fg_stock_latest_product_region_base: {
        Row: {
          as_of_date: string | null
          product_id: number | null
          qty_base_units: number | null
          region_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_fg_stock_latest_sku_region: {
        Row: {
          as_of_date: string | null
          product_id: number | null
          qty_units: number | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_fg_stock_product_region_all: {
        Row: {
          as_of_date: string | null
          product_id: number | null
          qty_units: number | null
          region_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_fg_storage_residuals: {
        Row: {
          balance_base: number | null
          product_id: number | null
          work_log_id: number | null
        }
        Relationships: []
      }
      v_fg_transfer_missing_log: {
        Row: {
          all_godown_mapped: boolean | null
          all_lines_sku_mapped: boolean | null
          all_sku_mapped: boolean | null
          any_dwl_id: number | null
          batch_code: string | null
          dwl_row_count: number | null
          exists_in_log: boolean | null
          exists_in_tally: boolean | null
          is_exact_breakdown_match: boolean | null
          is_product_mapped: boolean | null
          log_breakdown_by_skuid: Json | null
          log_breakdown_lines: Json | null
          log_completed_on: string | null
          log_created_at: string | null
          log_status: string | null
          log_total_packs: number | null
          log_uploaded_by: string | null
          product_id: number | null
          product_name: string | null
          recon_status: string | null
          tally_breakdown_by_skuid: Json | null
          tally_breakdown_lines: Json | null
          tally_total_in_base: number | null
          tally_total_packs: number | null
          tally_uom_base_unit: string | null
          transfer_date: string | null
        }
        Relationships: []
      }
      v_fg_transfer_reconciliation: {
        Row: {
          all_godown_mapped: boolean | null
          all_lines_sku_mapped: boolean | null
          all_sku_mapped: boolean | null
          any_dwl_id: number | null
          batch_code: string | null
          dwl_row_count: number | null
          exists_in_log: boolean | null
          exists_in_tally: boolean | null
          is_exact_breakdown_match: boolean | null
          is_product_mapped: boolean | null
          log_breakdown_by_skuid: Json | null
          log_breakdown_lines: Json | null
          log_completed_on: string | null
          log_created_at: string | null
          log_status: string | null
          log_total_packs: number | null
          log_uploaded_by: string | null
          product_id: number | null
          product_name: string | null
          recon_status: string | null
          tally_breakdown_by_skuid: Json | null
          tally_breakdown_lines: Json | null
          tally_total_in_base: number | null
          tally_total_packs: number | null
          tally_uom_base_unit: string | null
          transfer_date: string | null
        }
        Relationships: []
      }
      v_fg_wip_stock_by_product_base: {
        Row: {
          product_id: number | null
          qty_base: number | null
        }
        Relationships: []
      }
      v_fill_inputs: {
        Row: {
          forecast_units_pm: number | null
          godown_code: string | null
          net_per_unit_base: number | null
          product_id: number | null
          region_code: string | null
          sku_id: number | null
          stock_rate: number | null
          stock_units: number | null
          stock_value: number | null
        }
        Relationships: []
      }
      v_fill_inputs_monthly: {
        Row: {
          forecast_units_pm: number | null
          godown_code: string | null
          month_start: string | null
          net_per_unit_base: number | null
          product_id: number | null
          region_code: string | null
          sku_id: number | null
          stock_units: number | null
        }
        Relationships: []
      }
      v_forecast_baseline_effective: {
        Row: {
          demand_baseline: number | null
          demand_effective: number | null
          godown_id: number | null
          item: string | null
          month_start: string | null
          override_delta: number | null
          pack_size: number | null
          product_id: number | null
          region_id: number | null
          sku_id: number | null
          sku_label: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_forecast_exceptions: {
        Row: {
          demand_baseline: number | null
          godown_code: string | null
          godown_id: number | null
          is_llt: boolean | null
          is_seasonal: boolean | null
          item: string | null
          month_start: string | null
          pack_size: number | null
          product_id: number | null
          region_code: string | null
          region_id: number | null
          sku_id: number | null
          sku_label: string | null
          supply_final: number | null
          supply_llt: number | null
          supply_seasonal: number | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_forecast_override_cells_active: {
        Row: {
          baseline_original: number | null
          baseline_with_override: number | null
          created_at: string | null
          created_by: string | null
          godown_id: number | null
          month_start: string | null
          override_delta: number | null
          reason: string | null
          region_id: number | null
          sku_id: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_forecast_overrides_summary: {
        Row: {
          cells_overridden: number | null
          total_delta_units: number | null
        }
        Relationships: []
      }
      v_forecast_overview: {
        Row: {
          negatives: number | null
          out_of_season_rows: number | null
          pairs: number | null
          rows_base_12m: number | null
          rows_llt_12m: number | null
          rows_seasonal_12m: number | null
        }
        Relationships: []
      }
      v_forecast_plan_12m: {
        Row: {
          demand_baseline: number | null
          godown_id: number | null
          month_start: string | null
          region_id: number | null
          sku_id: number | null
          supply_final: number | null
          supply_llt: number | null
          supply_seasonal: number | null
        }
        Relationships: []
      }
      v_forecast_production_plan_godown: {
        Row: {
          demand_baseline: number | null
          godown_id: number | null
          month_start: string | null
          opening_stock_at_start: number | null
          production_qty: number | null
          projected_stock_after_prod: number | null
          projected_stock_before_prod: number | null
          region_id: number | null
          sku_id: number | null
          target_stock: number | null
        }
        Relationships: []
      }
      v_forecast_production_plan_net_sku: {
        Row: {
          bottled_soh_applied: number | null
          demand_baseline: number | null
          month_start: string | null
          net_production_qty: number | null
          opening_stock: number | null
          production_qty: number | null
          projected_stock_after_prod_net: number | null
          projected_stock_before_prod: number | null
          sku_id: number | null
          target_stock: number | null
        }
        Relationships: []
      }
      v_forecast_production_plan_region: {
        Row: {
          demand_baseline: number | null
          month_start: string | null
          opening_stock: number | null
          production_qty: number | null
          projected_stock_after_prod: number | null
          projected_stock_before_prod: number | null
          region_id: number | null
          sku_id: number | null
          target_stock: number | null
        }
        Relationships: []
      }
      v_forecast_production_plan_sku: {
        Row: {
          demand_baseline: number | null
          month_start: string | null
          opening_stock: number | null
          production_qty: number | null
          projected_stock_after_prod: number | null
          projected_stock_before_prod: number | null
          sku_id: number | null
          target_stock: number | null
        }
        Relationships: []
      }
      v_forecast_rollup_annual_calendar: {
        Row: {
          demand_total: number | null
          godown_id: number | null
          region_id: number | null
          sku_id: number | null
          supply_total: number | null
          year: number | null
        }
        Relationships: []
      }
      v_forecast_rollup_annual_window: {
        Row: {
          demand_total: number | null
          godown_id: number | null
          region_id: number | null
          sku_id: number | null
          supply_total: number | null
          window_end_month: string | null
          window_start_month: string | null
        }
        Relationships: []
      }
      v_forecast_rollup_halfyear: {
        Row: {
          demand_total: number | null
          godown_id: number | null
          half: number | null
          region_id: number | null
          sku_id: number | null
          supply_total: number | null
          year: number | null
        }
        Relationships: []
      }
      v_forecast_rollup_quarterly: {
        Row: {
          demand_total: number | null
          godown_id: number | null
          quarter: number | null
          region_id: number | null
          sku_id: number | null
          supply_total: number | null
          year: number | null
        }
        Relationships: []
      }
      v_forecast_runs_recent: {
        Row: {
          as_of_date: string | null
          closed_at: string | null
          created_at: string | null
          id: number | null
          rows_base: number | null
          rows_llt: number | null
          rows_seasonal: number | null
          status: string | null
        }
        Relationships: []
      }
      v_health_jobs_today: {
        Row: {
          done: number | null
          errors: number | null
          in_progress: number | null
          job_type: string | null
          queued: number | null
          run_date: string | null
        }
        Relationships: []
      }
      v_health_last_heartbeat: {
        Row: {
          agent_ver: string | null
          hostname: string | null
          last_error: string | null
          last_seen_at: string | null
        }
        Relationships: []
      }
      v_health_mapping_today: {
        Row: {
          as_of_date: string | null
          missing_godown_rows: number | null
          missing_sku_rows: number | null
          pct_resolvable: number | null
          total_rows: number | null
        }
        Relationships: []
      }
      v_health_snapshot_today: {
        Row: {
          as_of_date: string | null
          godowns_with_rows: number | null
          rows_today: number | null
        }
        Relationships: []
      }
      v_hub_requests_pending: {
        Row: {
          created_at: string | null
          note: string | null
          request_id: number | null
          status: string | null
          user_email: string | null
          user_id: string | null
          utility_id: string | null
          utility_key: string | null
          utility_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_access_requests_utility_id_fkey"
            columns: ["utility_id"]
            isOneToOne: false
            referencedRelation: "hub_utilities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inv_stock_item_alias_coverage: {
        Row: {
          ignored_count: number | null
          mapped_count: number | null
          source_kind: string | null
          suspect_count: number | null
          total_aliases: number | null
          unmapped_count: number | null
        }
        Relationships: []
      }
      v_inv_stock_item_alias_search: {
        Row: {
          alias_key: string | null
          created_at: string | null
          first_seen: string | null
          id: number | null
          inv_active: boolean | null
          inv_code: string | null
          inv_default_uom_id: number | null
          inv_hsn_code: string | null
          inv_name: string | null
          inv_stock_item_id: number | null
          last_seen: string | null
          last_updated_at: string | null
          note: string | null
          source_kind: string | null
          source_system: string | null
          status: string | null
          tally_item_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["inv_default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["inv_default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["inv_default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inv_stock_item_with_class: {
        Row: {
          active: boolean | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          default_uom_id: number | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          hsn_code: string | null
          name: string | null
          stock_item_id: number | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_consumption_consumables_monthly: {
        Row: {
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          fy_start_date: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          name: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_consumption_monthly: {
        Row: {
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          fy_start_date: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          name: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          total_consumed_qty: number | null
        }
        Relationships: []
      }
      v_item_consumption_monthly_agg: {
        Row: {
          consumable_out_qty: number | null
          first_month: string | null
          inv_stock_item_id: number | null
          last_month: string | null
          rm_pm_issue_qty: number | null
          total_consumed_qty: number | null
          usage_months: number | null
        }
        Relationships: []
      }
      v_item_consumption_monthly_base: {
        Row: {
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          fy_start_date: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          name: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: []
      }
      v_item_consumption_monthly_by_item: {
        Row: {
          consumable_out_qty: number | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          total_consumed_qty: number | null
        }
        Relationships: []
      }
      v_item_consumption_rm_pm_monthly: {
        Row: {
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          fy_start_date: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          name: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_consumption_summary_by_item: {
        Row: {
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          first_month: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          last_month: string | null
          months_with_usage: number | null
          name: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          total_consumed_qty: number | null
        }
        Relationships: []
      }
      v_item_supply_overview: {
        Row: {
          avg_purchase_rate: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          consumable_out_qty: number | null
          current_stock_qty: number | null
          current_stock_rate: number | null
          first_month: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          last_month: string | null
          last_purchase_date: string | null
          months_with_usage: number | null
          name: string | null
          purchase_lines: number | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          total_consumed_qty: number | null
          total_purchased_qty: number | null
          total_purchased_value: number | null
        }
        Relationships: []
      }
      v_job_activity: {
        Row: {
          first_created: string | null
          job_type: string | null
          jobs: number | null
          last_finished: string | null
          status: Database["public"]["Enums"]["job_status"] | null
        }
        Relationships: []
      }
      v_job_activity_detailed: {
        Row: {
          first_created: string | null
          job_type: string | null
          jobs: number | null
          last_finished: string | null
          report_key: string | null
          status: Database["public"]["Enums"]["job_status"] | null
        }
        Relationships: []
      }
      v_last_heartbeat: {
        Row: {
          agent_ver: string | null
          hostname: string | null
          last_error: string | null
          last_seen_at: string | null
        }
        Insert: {
          agent_ver?: string | null
          hostname?: string | null
          last_error?: string | null
          last_seen_at?: string | null
        }
        Update: {
          agent_ver?: string | null
          hostname?: string | null
          last_error?: string | null
          last_seen_at?: string | null
        }
        Relationships: []
      }
      v_marketing_baseline_export: {
        Row: {
          baseline_demand: number | null
          godown_id: number | null
          month_start: string | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_marketing_overrides_staging_issues: {
        Row: {
          delta_units: number | null
          godown_id: number | null
          id: number | null
          month_start: string | null
          note: string | null
          problems: string[] | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_missing_vreg_dates: {
        Row: {
          day_of_week: string | null
          done_jobs_for_date: number | null
          failed_jobs_for_date: number | null
          in_progress_jobs_for_date: number | null
          is_weekend: boolean | null
          last_attempts: number | null
          last_created_at: string | null
          last_error_text: string | null
          last_finished_at: string | null
          last_idempotency_key: string | null
          last_job_id: string | null
          last_not_before: string | null
          last_priority: number | null
          last_started_at: string | null
          last_status: Database["public"]["Enums"]["job_status"] | null
          missing_voucher_date: string | null
          other_jobs_for_date: number | null
          total_jobs_for_date: number | null
          was_enqueued_before: boolean | null
        }
        Relationships: []
      }
      v_mrp_horizon_active: {
        Row: {
          horizon_end: string | null
          horizon_start: string | null
          overlay_run_id: string | null
        }
        Relationships: []
      }
      v_mrp_material_exception_no_plan_but_issued: {
        Row: {
          allocation_approx_present: boolean | null
          has_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          material_type: string | null
          net_requirement: number | null
          planned_total_qty: number | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          stock_uom_code: string | null
          top_consumers: Json | null
        }
        Relationships: []
      }
      v_mrp_material_exception_over_issued: {
        Row: {
          allocation_approx_present: boolean | null
          has_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          material_type: string | null
          net_requirement: number | null
          planned_total_qty: number | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          stock_uom_code: string | null
          top_consumers: Json | null
        }
        Relationships: []
      }
      v_mrp_material_exception_planned_not_issued: {
        Row: {
          allocation_approx_present: boolean | null
          has_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          material_type: string | null
          net_requirement: number | null
          planned_total_qty: number | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          stock_uom_code: string | null
          top_consumers: Json | null
        }
        Relationships: []
      }
      v_mrp_material_gross_requirement: {
        Row: {
          conversion_applied: boolean | null
          gross_required_qty: number | null
          material_kind: string | null
          month_start: string | null
          seasonal_overlay_run_id: string | null
          stock_item_id: number | null
          uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_material_gross_requirement_pm: {
        Row: {
          conversion_applied: boolean | null
          gross_required_qty: number | null
          material_kind: string | null
          month_start: string | null
          seasonal_overlay_run_id: string | null
          stock_item_id: number | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrp_material_gross_requirement_pm_detail: {
        Row: {
          gross_required_qty: number | null
          is_optional: boolean | null
          material_kind: string | null
          month_start: string | null
          planned_plm_qty: number | null
          plm_qty_per_unit: number | null
          product_id: number | null
          region_code: string | null
          sku_id: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          units_to_fill: number | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrp_material_gross_requirement_rm: {
        Row: {
          conversion_applied: boolean | null
          gross_required_qty: number | null
          material_kind: string | null
          month_start: string | null
          seasonal_overlay_run_id: string | null
          stock_item_id: number | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
        ]
      }
      v_mrp_material_month_grid: {
        Row: {
          gross_required_qty: number | null
          material_kind: string | null
          month_start: string | null
          opening_qty_anchor: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          uom_code: string | null
          uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_material_monthly_overview: {
        Row: {
          allocation_approx_present: boolean | null
          any_exception: boolean | null
          has_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          material_kind: string | null
          net_requirement: number | null
          no_plan_but_issued: boolean | null
          over_issued: boolean | null
          planned_but_not_issued: boolean | null
          planned_total_qty: number | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          stock_uom_code: string | null
          top_consumers: Json | null
        }
        Relationships: []
      }
      v_mrp_material_monthly_stats: {
        Row: {
          exception_items: number | null
          has_any_plan: boolean | null
          horizon_start: string | null
          is_no_plan_month: boolean | null
          issued_items: number | null
          issued_sum: number | null
          material_kind: string | null
          net_sum: number | null
          no_plan_but_issued_items: number | null
          over_issued_items: number | null
          planned_items: number | null
          planned_not_issued_items: number | null
          planned_sum: number | null
          total_items: number | null
        }
        Relationships: []
      }
      v_mrp_material_summary_monthly: {
        Row: {
          any_allocation_approx: boolean | null
          any_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          items: number | null
          material_type: string | null
          net_requirement: number | null
          planned_total_qty: number | null
        }
        Relationships: []
      }
      v_mrp_month_buckets_active: {
        Row: {
          month_start: string | null
        }
        Relationships: []
      }
      v_mrp_opening_stock_snapshot: {
        Row: {
          avg_rate_value: number | null
          material_kind: string | null
          opening_qty: number | null
          stock_item_id: number | null
        }
        Relationships: []
      }
      v_mrp_plm_by_sku_region: {
        Row: {
          allocation_approx: boolean | null
          curr_mos: number | null
          forecast_units_pm: number | null
          gap_mos: number | null
          is_optional_plm: boolean | null
          issued_plm_qty: number | null
          over_issued_qty: number | null
          period_end: string | null
          period_start: string | null
          planned_plm_qty: number | null
          plm_name: string | null
          plm_qty_per_unit: number | null
          plm_stock_item_id: number | null
          plm_uom: string | null
          product_id: number | null
          product_name: string | null
          region_code: string | null
          remaining_plm_qty: number | null
          sku_id: number | null
          sku_name: string | null
          stock_units: number | null
          target_mos: number | null
          units_to_fill: number | null
          used_base_qty: number | null
        }
        Relationships: []
      }
      v_mrp_plm_issue_monthly_allocated: {
        Row: {
          allocation_approx: boolean | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_plm_qty: number | null
          plm_stock_item_id: number | null
          product_id: number | null
          region_code: string | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_mrp_plm_issue_monthly_enriched: {
        Row: {
          allocation_approx: boolean | null
          conversion_to_base: number | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_plm_qty: number | null
          malayalam_name: string | null
          pack_size: number | null
          plm_code: string | null
          plm_name: string | null
          plm_stock_item_id: number | null
          plm_uom_code: string | null
          product_id: number | null
          product_name: string | null
          region_code: string | null
          sku_id: number | null
          sku_is_active: boolean | null
          sku_name: string | null
          sku_status: string | null
          sku_uom: string | null
          uom_base: string | null
        }
        Relationships: []
      }
      v_mrp_plm_planned_vs_issued_overview: {
        Row: {
          allocation_approx_present: boolean | null
          has_unassigned_issues: boolean | null
          horizon_start: string | null
          issued_total_qty: number | null
          net_requirement: number | null
          planned_total_qty: number | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          stock_uom_code: string | null
          top_consumers: Json | null
        }
        Relationships: []
      }
      v_mrp_plm_summary: {
        Row: {
          allocation_approx_present: boolean | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_kind: string | null
          horizon_start: string | null
          issued_total_plm_qty: number | null
          net_plm_requirement: number | null
          planned_total_plm_qty: number | null
          plm_name: string | null
          plm_stock_item_id: number | null
          plm_uom: string | null
          top_consuming_skus: Json | null
        }
        Relationships: []
      }
      v_mrp_plm_trace: {
        Row: {
          allocation_approx: boolean | null
          first_issue_date: string | null
          gross_required_plm_qty: number | null
          has_unassigned_issues: boolean | null
          issue_vouchers: string[] | null
          issued_plm_qty: number | null
          last_issue_date: string | null
          material_kind: string | null
          period_start: string | null
          planned_plm_qty: number | null
          plm_name: string | null
          plm_stock_item_id: number | null
          product_id: number | null
          region_code: string | null
          remaining_plm_qty: number | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_mrp_pm_contrib_detail: {
        Row: {
          gross_required_qty: number | null
          is_optional: boolean | null
          month_start: string | null
          planned_plm_qty: number | null
          plm_qty_per_unit: number | null
          product_id: number | null
          qty_from_planned: number | null
          qty_from_units: number | null
          qty_source: string | null
          region_code: string | null
          sku_id: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          units_to_fill: number | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrp_pm_contrib_summary: {
        Row: {
          contributing_products: number | null
          contributing_regions: number | null
          contributing_rows: number | null
          contributing_skus: number | null
          gross_non_optional_qty: number | null
          gross_optional_qty: number | null
          gross_required_qty: number | null
          month_start: string | null
          qty_from_planned_plm_qty: number | null
          qty_from_units_calc: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrp_procurement_plan: {
        Row: {
          carry_in_excess: number | null
          carry_out_excess: number | null
          closing_qty: number | null
          gross_ceiling_applied: boolean | null
          gross_required_qty: number | null
          gross_required_qty_post_ceiling: number | null
          gross_required_qty_pre_ceiling: number | null
          material_kind: string | null
          month_start: string | null
          moq_qty: number | null
          net_need_qty: number | null
          opening_qty: number | null
          procure_qty: number | null
          procure_qty_post_ceiling: number | null
          procure_qty_pre_ceiling: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          uom_code: string | null
          uom_dimension_id: number | null
          uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_by_batch: {
        Row: {
          allocation_approx: boolean | null
          batch_id: number | null
          batch_number: string | null
          batch_size: number | null
          batch_status: string | null
          batch_uom: string | null
          bom_revision_id: number | null
          has_unassigned_issues: boolean | null
          issue_vouchers: string[] | null
          issued_rm_qty: number | null
          last_issue_voucher_date: string | null
          over_issued_qty: number | null
          period_start: string | null
          planned_rm_qty: number | null
          product_id: number | null
          product_name: string | null
          remaining_rm_qty: number | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_trace_path: Json | null
          rm_uom: string | null
          source_rule: string | null
        }
        Relationships: []
      }
      v_mrp_rm_by_product_period: {
        Row: {
          allocation_approx_present: boolean | null
          batch_count: number | null
          batch_status_breakdown: Json | null
          has_unassigned_issues: boolean | null
          period_end: string | null
          period_start: string | null
          product_id: number | null
          product_name: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom: string | null
          total_issued_rm_qty: number | null
          total_over_issued_qty: number | null
          total_planned_rm_qty: number | null
          total_remaining_rm_qty: number | null
        }
        Relationships: []
      }
      v_mrp_rm_conversion_contrib_detail: {
        Row: {
          consume_item_name: string | null
          consume_stock_item_id: number | null
          conversion_applied: boolean | null
          factor: number | null
          month_start: string | null
          purchase_item_name: string | null
          purchase_stock_item_id: number | null
          qty_consume_form: number | null
          qty_purchase_equiv: number | null
          required_uom_id: number | null
          uom_code: string | null
        }
        Relationships: []
      }
      v_mrp_rm_conversion_contrib_summary: {
        Row: {
          any_conversion_applied: boolean | null
          converted_in_to_purchase_item: number | null
          direct_on_purchase_item: number | null
          month_start: string | null
          purchase_item_name: string | null
          purchase_stock_item_id: number | null
          required_uom_id: number | null
          total_purchase_form_baseline: number | null
          uom_code: string | null
        }
        Relationships: []
      }
      v_mrp_rm_exception_no_plan_but_issued: {
        Row: {
          allocation_approx: boolean | null
          consumers_json: Json | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          no_plan_but_issued: boolean | null
          over_issued: boolean | null
          pct_issued_vs_planned: number | null
          planned_but_not_issued: boolean | null
          planned_rm_qty: number | null
          qty_variance: number | null
          remaining_rm_qty: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom_code: string | null
          rm_uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_exception_over_issued: {
        Row: {
          allocation_approx: boolean | null
          consumers_json: Json | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          no_plan_but_issued: boolean | null
          over_issued: boolean | null
          pct_issued_vs_planned: number | null
          planned_but_not_issued: boolean | null
          planned_rm_qty: number | null
          qty_variance: number | null
          remaining_rm_qty: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom_code: string | null
          rm_uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_exception_planned_not_issued: {
        Row: {
          allocation_approx: boolean | null
          consumers_json: Json | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          no_plan_but_issued: boolean | null
          over_issued: boolean | null
          pct_issued_vs_planned: number | null
          planned_but_not_issued: boolean | null
          planned_rm_qty: number | null
          qty_variance: number | null
          remaining_rm_qty: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom_code: string | null
          rm_uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_issue_monthly_allocated: {
        Row: {
          allocation_approx: boolean | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          product_id: number | null
          region_code: string | null
          rm_stock_item_id: number | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_issue_monthly_enriched: {
        Row: {
          allocation_approx: boolean | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          malayalam_name: string | null
          product_id: number | null
          product_name: string | null
          region_code: string | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom_code: string | null
          sku_id: number | null
          sku_name: string | null
        }
        Relationships: []
      }
      v_mrp_rm_missing_uom: {
        Row: {
          default_uom_code: string | null
          default_uom_id: number | null
          detail_line_count: number | null
          month_start: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrp_rm_overlay_season_monthly: {
        Row: {
          month_start: string | null
          overlay_procure_qty: number | null
          overlay_run_id: string | null
          rm_stock_item_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_mrp_rm_overlay_season_monthly_active: {
        Row: {
          month_start: string | null
          overlay_procure_qty: number | null
          overlay_run_id: string | null
          rm_stock_item_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_rm_stock_item_id_fkey"
            columns: ["rm_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_mrp_rm_plan_product: {
        Row: {
          from_fp_bom_qty: number | null
          from_sp_bom_qty: number | null
          gross_required_qty_plan: number | null
          month_start: string | null
          mrp_run_id: string | null
          product_id: number | null
          stock_item_id: number | null
          uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_planned_vs_issued_overview: {
        Row: {
          allocation_approx: boolean | null
          consumers_json: Json | null
          has_unassigned_issues: boolean | null
          horizon_end: string | null
          horizon_start: string | null
          issued_rm_qty: number | null
          no_plan_but_issued: boolean | null
          over_issued: boolean | null
          pct_issued_vs_planned: number | null
          planned_but_not_issued: boolean | null
          planned_rm_qty: number | null
          qty_variance: number | null
          remaining_rm_qty: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_uom_code: string | null
          rm_uom_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_procurement_pre_net: {
        Row: {
          baseline_required_qty: number | null
          final_required_pre_net_qty: number | null
          month_start: string | null
          overlay_seasonal_qty: number | null
          required_uom_id: number | null
          rm_stock_item_id: number | null
          seasonal_overlay_run_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
        ]
      }
      v_mrp_rm_procurement_pre_net_baseline: {
        Row: {
          baseline_required_qty: number | null
          month_start: string | null
          required_uom_id: number | null
          rm_stock_item_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_procurement_pre_net_baseline_enriched: {
        Row: {
          baseline_required_qty: number | null
          month_start: string | null
          required_uom_id: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          uom_code: string | null
        }
        Relationships: []
      }
      v_mrp_rm_procurement_pre_net_baseline_purchase_form: {
        Row: {
          baseline_required_qty: number | null
          conversion_applied: boolean | null
          month_start: string | null
          required_uom_id: number | null
          rm_stock_item_id: number | null
        }
        Relationships: []
      }
      v_mrp_rm_procurement_pre_net_enriched: {
        Row: {
          baseline_required_qty: number | null
          final_required_pre_net_qty: number | null
          month_start: string | null
          overlay_seasonal_qty: number | null
          required_uom_id: number | null
          rm_code: string | null
          rm_name: string | null
          rm_stock_item_id: number | null
          seasonal_overlay_run_id: string | null
          uom_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
        ]
      }
      v_mrp_rm_procurement_pre_net_purchase_form: {
        Row: {
          baseline_required_qty: number | null
          conversion_applied: boolean | null
          final_required_pre_net_qty: number | null
          month_start: string | null
          overlay_seasonal_qty: number | null
          required_uom_id: number | null
          rm_stock_item_id: number | null
          seasonal_overlay_run_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "mrp_rm_overlay_season_runs"
            referencedColumns: ["overlay_run_id"]
          },
          {
            foreignKeyName: "mrp_rm_overlay_season_detail_overlay_run_id_fkey"
            columns: ["seasonal_overlay_run_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_horizon_active"
            referencedColumns: ["overlay_run_id"]
          },
        ]
      }
      v_mrp_rm_trace_batch: {
        Row: {
          batch_id: number | null
          batch_number: string | null
          batch_size: number | null
          batch_status: string | null
          batch_uom: string | null
          first_issue_date: string | null
          issue_vouchers: string[] | null
          issued_rm_qty: number | null
          last_issue_date: string | null
          period_start: string | null
          planned_rm_qty: number | null
          product_id: number | null
          product_name: string | null
          remaining_rm_qty: number | null
          rm_name: string | null
          rm_stock_item_id: number | null
          rm_trace_path: Json | null
        }
        Relationships: []
      }
      v_mrp_rm_trace_horizon: {
        Row: {
          allocation_approx: boolean | null
          batch_count: number | null
          batch_status_breakdown: Json | null
          first_issue_date: string | null
          has_unassigned_issues: boolean | null
          issue_vouchers: string[] | null
          issued_rm_qty: number | null
          last_issue_date: string | null
          material_kind: string | null
          period_start: string | null
          planned_rm_qty: number | null
          product_id: number | null
          product_name: string | null
          remaining_rm_qty: number | null
          rm_name: string | null
          rm_stock_item_id: number | null
        }
        Relationships: []
      }
      v_mrp_stage_requirements: {
        Row: {
          period_start: string | null
          plm_batch_count: number | null
          plm_planned_qty: number | null
          rm_batch_count: number | null
          rm_planned_qty: number | null
          stage: string | null
          top_plm_items: Json | null
          top_rm_items: Json | null
        }
        Relationships: []
      }
      v_mrp_trace_unified: {
        Row: {
          allocation_approx: boolean | null
          first_issue_date: string | null
          has_unassigned_issues: boolean | null
          issue_vouchers: string[] | null
          issued_qty: number | null
          last_issue_date: string | null
          material_kind: string | null
          period_start: string | null
          planned_qty: number | null
          product_id: number | null
          region_code: string | null
          remaining_qty: number | null
          sku_id: number | null
          stock_item_id: number | null
          stock_item_name: string | null
        }
        Relationships: []
      }
      v_pack_format_picker: {
        Row: {
          line_count: number | null
          pack_format_code: string | null
          process_loss_pct: number | null
          reference_output_qty: number | null
          tpl_id: number | null
          uom_code: string | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_picker_products: {
        Row: {
          id: number | null
          label: string | null
          uom_code: string | null
        }
        Relationships: []
      }
      v_picker_sp_owners: {
        Row: {
          category_code: string | null
          default_uom_code: string | null
          id: number | null
          label: string | null
          subcategory_code: string | null
        }
        Relationships: []
      }
      v_product_batches_plan: {
        Row: {
          batch_no: number | null
          batch_qty: number | null
          final_make_qty: number | null
          is_remainder: boolean | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          needs_batch_size: boolean | null
          preferred_batch_size: number | null
          product_id: number | null
        }
        Relationships: []
      }
      v_product_bulk_adjusted_to_base: {
        Row: {
          adjusted_bulk_to_make: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          need_after_carry: number | null
          need_qty: number | null
          preferred_batch_size: number | null
          product_id: number | null
          source_rule: string | null
        }
        Relationships: []
      }
      v_product_bulk_consolidated: {
        Row: {
          adjusted_bulk_to_make: number | null
          carry_to_next: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          need_after_carry: number | null
          need_qty: number | null
          needs_batch_ref: boolean | null
          preferred_batch_size: number | null
          product_id: number | null
          source_rule: string | null
        }
        Relationships: []
      }
      v_product_bulk_consolidated_effective: {
        Row: {
          carry_to_next: number | null
          final_make_qty: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          need_after_carry: number | null
          need_qty: number | null
          needs_base_qty: boolean | null
          override_delta: number | null
          planned_make_qty: number | null
          preferred_batch_size: number | null
          product_id: number | null
          source_rule: string | null
        }
        Relationships: []
      }
      v_product_bulk_consolidated_effective_with_batches: {
        Row: {
          batch_count: number | null
          batch_sizes: number[] | null
          carry_to_next: number | null
          final_make_qty: number | null
          max_batch_size: number | null
          min_batch_size: number | null
          month_start: string | null
          need_after_carry: number | null
          need_qty: number | null
          needs_base_qty: boolean | null
          override_delta: number | null
          planned_make_qty: number | null
          preferred_batch_size: number | null
          product_id: number | null
          residual_qty: number | null
          source_rule: string | null
        }
        Relationships: []
      }
      v_product_bulk_net_to_make: {
        Row: {
          bulk_required: number | null
          month_start: string | null
          net_bulk_to_make: number | null
          product_id: number | null
          remaining_soh_after: number | null
          soh_applied: number | null
          uom_base: string | null
        }
        Relationships: []
      }
      v_product_bulk_net_to_make_after_wip: {
        Row: {
          month_start: string | null
          net_bulk_after_wip: number | null
          net_bulk_before_wip: number | null
          product_id: number | null
          wip_deducted_this_month: number | null
          wip_pool_after: number | null
          wip_pool_before: number | null
        }
        Relationships: []
      }
      v_product_bulk_required_monthly: {
        Row: {
          bulk_required: number | null
          month_start: string | null
          product_id: number | null
          uom_base: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_product_bulk_soh: {
        Row: {
          last_updated: string | null
          product_id: number | null
          soh_qty: number | null
          uom_base: string | null
        }
        Relationships: []
      }
      v_product_details: {
        Row: {
          category_name: string | null
          group_name: string | null
          malayalam_name: string | null
          product_hierarchy: string | null
          product_id: number | null
          product_name: string | null
          status: string | null
          sub_group_name: string | null
          subcategory_name: string | null
          uom_base: string | null
        }
        Relationships: []
      }
      v_product_name_map: {
        Row: {
          product_id: number | null
          product_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_purchases_by_item: {
        Row: {
          avg_rate_value: number | null
          billed_amount_value: number | null
          canonical_qty_value: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          godown_label: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          name: string | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          supplier_name: string | null
          tally_item_name: string | null
          voucher_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
        ]
      }
      v_purchases_summary_by_item: {
        Row: {
          avg_purchase_rate: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          last_purchase_date: string | null
          name: string | null
          purchase_lines: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          total_purchased_qty: number | null
          total_purchased_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rm_pm_issues_clean: {
        Row: {
          allocation_approx: boolean | null
          batch_number: string | null
          batch_number_raw: string | null
          bmr_batch_size: number | null
          bmr_batch_uom: string | null
          bmr_bn_original: string | null
          bmr_id: number | null
          bn_count: number | null
          bn_source: string | null
          bom_name: string | null
          entry_mode: string | null
          extraction_note: string | null
          fg_batch_no: string | null
          fg_batch_size_qty: number | null
          id: number | null
          inserted_at: string | null
          issue_type: string | null
          issue_type_raw: string | null
          issue_type_source: string | null
          material_item_name: string | null
          material_qty_original: number | null
          material_qty_split: number | null
          material_uom_raw: string | null
          narration_text: string | null
          parent_count: number | null
          product_id: number | null
          product_name: string | null
          product_name_raw: string | null
          source_key: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          voucher_date: string | null
          voucher_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_rm_pm_issues_unmapped: {
        Row: {
          alias_status: string | null
          batch_count: number | null
          inv_stock_item_id: number | null
          issue_type_source_sample: string | null
          line_count: number | null
          material_item_name: string | null
          material_uom_raw: string | null
          source_keys: string[] | null
          source_kind: string | null
          stock_item_name: string | null
          total_qty_original: number | null
          total_qty_split: number | null
          voucher_count: number | null
          voucher_numbers: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_inv_stock_item_with_class"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_consumables_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_consumption_rm_pm_monthly"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_picker_sp_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_purchases_summary_by_item"
            referencedColumns: ["inv_stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_seasonal_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_rm_stock_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_semiprocess_items"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_item_picker"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inv_stock_item_alias_inv_stock_item_id_fkey"
            columns: ["inv_stock_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_items_with_semiflag"
            referencedColumns: ["stock_item_id"]
          },
        ]
      }
      v_rm_seasonal_items: {
        Row: {
          category_code: string | null
          category_label: string | null
          code: string | null
          mapping_active: boolean | null
          month_split_pct: Json | null
          name: string | null
          season_label: string | null
          season_months: number[] | null
          season_profile_id: number | null
          stock_item_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_season_profile_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "season_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_season_profile_season_profile_id_fkey"
            columns: ["season_profile_id"]
            isOneToOne: false
            referencedRelation: "v_season_calendar"
            referencedColumns: ["season_profile_id"]
          },
        ]
      }
      v_rm_stock_items: {
        Row: {
          active: boolean | null
          category_code: string | null
          default_uom_id: number | null
          group_code: string | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
          subcategory_code: string | null
          subgroup_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sales_daily_normalized: {
        Row: {
          billed_amount: number | null
          godown_id: number | null
          inserted_at: string | null
          product_id: number | null
          qty_billed: number | null
          qty_units: number | null
          region_id: number | null
          sales_date: string | null
          sku_id: number | null
          source_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sales_monthly_clean: {
        Row: {
          godown_id: number | null
          month_start: string | null
          product_id: number | null
          qty_clean: number | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sales_qty_suspect: {
        Row: {
          godown_id: number | null
          inserted_at: string | null
          product_id: number | null
          qty_billed: number | null
          qty_units: number | null
          region_id: number | null
          sales_date: string | null
          sku_id: number | null
          source_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sales_unmapped_godowns: {
        Row: {
          act_qty_value: number | null
          bill_qty_value: number | null
          godown_label: string | null
          inserted_at: string | null
          sales_date: string | null
          source_key: string | null
          tally_item_name: string | null
        }
        Relationships: []
      }
      v_sales_unmapped_skus: {
        Row: {
          act_qty_value: number | null
          bill_qty_value: number | null
          godown_label: string | null
          inserted_at: string | null
          sales_date: string | null
          source_key: string | null
          tally_item_name: string | null
        }
        Relationships: []
      }
      v_sdv_dim_godown_region: {
        Row: {
          godown_code: string | null
          godown_id: number | null
          godown_name: string | null
          region_code: string | null
          region_id: number | null
          region_name: string | null
        }
        Relationships: []
      }
      v_sdv_dim_month: {
        Row: {
          calendar_month_no: number | null
          calendar_year: number | null
          month_label: string | null
          month_label_short: string | null
          month_start: string | null
        }
        Relationships: []
      }
      v_sdv_dim_product_hierarchy: {
        Row: {
          category_id: number | null
          category_name: string | null
          group_name: string | null
          product_group_id: number | null
          product_id: number | null
          product_name: string | null
          sub_group_id: number | null
          sub_group_name: string | null
          subcategory_id: number | null
          subcategory_name: string | null
        }
        Relationships: []
      }
      v_sdv_dim_sku: {
        Row: {
          is_active: boolean | null
          pack_size: number | null
          product_id: number | null
          product_name: string | null
          sku_id: number | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sdv_exc_zero_sellers_3m: {
        Row: {
          product_id: number | null
          product_name: string | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sdv_freshness: {
        Row: {
          freshness_status: string | null
          max_source_at: string | null
        }
        Relationships: []
      }
      v_sdv_rollup_month_category: {
        Row: {
          billed_amount: number | null
          calendar_month_no: number | null
          calendar_year: number | null
          category_id: number | null
          category_name: string | null
          month_start: string | null
          qty_base: number | null
          qty_billed: number | null
          qty_units: number | null
          subcategory_id: number | null
          subcategory_name: string | null
        }
        Relationships: []
      }
      v_sdv_rollup_month_godown_group: {
        Row: {
          billed_amount: number | null
          calendar_month_no: number | null
          calendar_year: number | null
          godown_id: number | null
          godown_name: string | null
          group_name: string | null
          month_start: string | null
          product_group_id: number | null
          qty_base: number | null
          qty_billed: number | null
          qty_units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
        ]
      }
      v_sdv_rollup_month_region: {
        Row: {
          billed_amount: number | null
          calendar_month_no: number | null
          calendar_year: number | null
          month_start: string | null
          qty_base: number | null
          qty_billed: number | null
          qty_units: number | null
          region_code: string | null
          region_id: number | null
          region_name: string | null
        }
        Relationships: []
      }
      v_sdv_rollup_month_sku: {
        Row: {
          billed_amount: number | null
          calendar_month_no: number | null
          calendar_year: number | null
          month_start: string | null
          product_id: number | null
          product_name: string | null
          qty_base: number | null
          qty_billed: number | null
          qty_units: number | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sdv_sales_enriched: {
        Row: {
          billed_amount: number | null
          calendar_month_no: number | null
          calendar_year: number | null
          category_id: number | null
          category_name: string | null
          godown_code: string | null
          godown_id: number | null
          godown_name: string | null
          group_name: string | null
          is_active: boolean | null
          month_label: string | null
          month_label_short: string | null
          month_start: string | null
          pack_size: number | null
          product_group_id: number | null
          product_id: number | null
          product_name: string | null
          qty_base: number | null
          qty_billed: number | null
          qty_units: number | null
          region_code: string | null
          region_id: number | null
          region_name: string | null
          sku_id: number | null
          source_max_inserted_at: string | null
          sub_group_id: number | null
          sub_group_name: string | null
          subcategory_id: number | null
          subcategory_name: string | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_season_calendar: {
        Row: {
          manufacture_months: number[] | null
          month_split_pct: Json | null
          season_label: string | null
          season_profile_id: number | null
        }
        Relationships: []
      }
      v_semiprocess_items: {
        Row: {
          is_semiprocess: boolean | null
          stock_item_id: number | null
        }
        Relationships: []
      }
      v_sku_catalog_enriched: {
        Row: {
          conversion_to_base: number | null
          is_active: boolean | null
          item: string | null
          malayalam_name: string | null
          pack_size: number | null
          product_id: number | null
          sku_id: number | null
          sku_label: string | null
          status: string | null
          uom: string | null
          uom_base: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sku_llt_attrs: {
        Row: {
          is_llt: boolean | null
          lead_time_months: number | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_sku_pack_format_map_picker: {
        Row: {
          created_at: string | null
          last_updated_at: string | null
          notes: string | null
          override_count: number | null
          pack_format_code: string | null
          pack_size: number | null
          pack_uom_code: string | null
          pack_uom_id: number | null
          process_loss_pct: number | null
          product_id: number | null
          product_name: string | null
          reference_output_qty: number | null
          sku_id: number | null
          sku_uom_code: string | null
          tpl_id: number | null
          tpl_line_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "plm_tpl_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_sku_pack_map_tpl_id_fkey"
            columns: ["tpl_id"]
            isOneToOne: false
            referencedRelation: "v_pack_format_picker"
            referencedColumns: ["tpl_id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["pack_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["pack_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "plm_tpl_header_reference_output_uom_id_fkey"
            columns: ["pack_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sku_picker: {
        Row: {
          active: boolean | null
          pack_size: number | null
          product_id: number | null
          product_name: string | null
          sku_id: number | null
          uom_code: string | null
          uom_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sku_planning_attrs: {
        Row: {
          is_llt: boolean | null
          is_seasonal: boolean | null
          lead_time_months: number | null
          manufacture_months: number[] | null
          month_split_pct: Json | null
          product_id: number | null
          sku_id: number | null
          status: string | null
        }
        Relationships: []
      }
      v_sku_plm_requirement_unit: {
        Row: {
          is_optional: boolean | null
          is_override: boolean | null
          pack_size: number | null
          pack_uom: string | null
          product_id: number | null
          product_name: string | null
          qty_per_reference_output: number | null
          qty_required_unit_final: number | null
          sku_id: number | null
          stock_item_id: number | null
          stock_item_name: string | null
          uom_code: string | null
          uom_id: number | null
          wastage_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sku_recent_stats: {
        Row: {
          godown_id: number | null
          med_last12_nz: number | null
          region_id: number | null
          sku_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sku_seasonal_attrs: {
        Row: {
          is_seasonal: boolean | null
          manufacture_months: number[] | null
          sku_id: number | null
        }
        Relationships: []
      }
      v_sku_stock_current: {
        Row: {
          as_of_date: string | null
          godown_id: number | null
          qty_units: number | null
          sku_id: number | null
          stock_rate: number | null
          stock_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_stock_snapshot_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_sku_to_base_multiplier: {
        Row: {
          base_qty_per_sku_unit: number | null
          pack_size: number | null
          product_base_uom: string | null
          product_id: number | null
          sku_id: number | null
          sku_uom: string | null
          uom_factor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sku_without_pack_format_map: {
        Row: {
          pack_size: number | null
          product_id: number | null
          product_name: string | null
          sku_id: number | null
          sku_uom_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_sop_flat: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          effective_date: string | null
          kind_code: string | null
          kind_id: string | null
          kind_name: string | null
          revision_id: string | null
          revision_updated_at: string | null
          series_code: string | null
          sop_id: string | null
          sop_number: string | null
          status: Database["public"]["Enums"]["sop_status"] | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
          version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_master_activity_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "activity_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_master_series_code_fkey"
            columns: ["series_code"]
            isOneToOne: false
            referencedRelation: "sop_series"
            referencedColumns: ["code"]
          },
        ]
      }
      v_stock_checker: {
        Row: {
          category_id: number | null
          category_name: string | null
          forecast_ik: number | null
          forecast_kkd: number | null
          forecast_ok: number | null
          item: string | null
          mos_ik: number | null
          mos_kkd: number | null
          mos_ok: number | null
          mos_overall: number | null
          mrp_ik: number | null
          mrp_ok: number | null
          pack_size: number | null
          product_group_id: number | null
          product_group_name: string | null
          product_id: number | null
          rate_ik: number | null
          rate_kkd: number | null
          rate_ok: number | null
          rate_overall: number | null
          shade_flag: boolean | null
          sku_id: number | null
          stock_ik: number | null
          stock_kkd: number | null
          stock_ok: number | null
          stock_value_ik: number | null
          stock_value_kkd: number | null
          stock_value_ok: number | null
          stock_value_overall: number | null
          sub_category_id: number | null
          sub_category_name: string | null
          sub_group_id: number | null
          sub_group_name: string | null
          uom: string | null
        }
        Relationships: []
      }
      v_stock_current_by_item: {
        Row: {
          avg_rate_value: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          name: string | null
          qty_value: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: []
      }
      v_stock_item_picker: {
        Row: {
          active: boolean | null
          category_code: string | null
          default_uom_code: string | null
          default_uom_id: number | null
          is_ind: boolean | null
          is_plm: boolean | null
          is_rm: boolean | null
          stock_item_code: string | null
          stock_item_id: number | null
          stock_item_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_items_with_semiflag: {
        Row: {
          active: boolean | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          default_uom_id: number | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          hsn_code: string | null
          is_semiprocess: boolean | null
          name: string | null
          stock_item_id: number | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_item_class_map_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inv_class_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "inv_class_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_class_map_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "inv_class_subgroup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "inv_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["uom_id"]
          },
          {
            foreignKeyName: "inv_stock_item_default_uom_id_fkey"
            columns: ["default_uom_id"]
            isOneToOne: false
            referencedRelation: "v_uom_picker"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_mapping_coverage_today: {
        Row: {
          as_of_date: string | null
          missing_godown_rows: number | null
          missing_sku_rows: number | null
          pct_resolvable: number | null
          total_rows: number | null
        }
        Relationships: []
      }
      v_stock_to_ids: {
        Row: {
          as_of_date: string | null
          godown_id: number | null
          godown_label: string | null
          qty_units: number | null
          sku_id: number | null
          tally_item_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_daily_batch_agg"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "godown_aliases_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "v_tally_fg_transfer_normalized"
            referencedColumns: ["transfer_godown_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_supply_recon: {
        Row: {
          bmr_not_initiated_cnt: number | null
          bottled_qty_base: number | null
          delta_qty: number | null
          fg_bulk_qty_base: number | null
          is_manual_needed: boolean | null
          item: string | null
          manual_qty: number | null
          month_start: string | null
          product_id: number | null
          reason: string | null
          set_id: number | null
          system_qty: number | null
          uom_base: string | null
          wip_qty_base: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "manual_plan_lines_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "manual_plan_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tally_expenses_today: {
        Row: {
          as_of_date: string | null
          credit_amount_value: number | null
          debit_amount_value: number | null
          expense_group: string | null
          head_name: string | null
          id: number | null
          inserted_at: string | null
          net_cb_value: number | null
          source_key: string | null
        }
        Insert: {
          as_of_date?: string | null
          credit_amount_value?: number | null
          debit_amount_value?: number | null
          expense_group?: string | null
          head_name?: string | null
          id?: number | null
          inserted_at?: string | null
          net_cb_value?: number | null
          source_key?: string | null
        }
        Update: {
          as_of_date?: string | null
          credit_amount_value?: number | null
          debit_amount_value?: number | null
          expense_group?: string | null
          head_name?: string | null
          id?: number | null
          inserted_at?: string | null
          net_cb_value?: number | null
          source_key?: string | null
        }
        Relationships: []
      }
      v_tally_fg_transfer_daily_batch_agg: {
        Row: {
          all_godown_mapped: boolean | null
          all_sku_mapped: boolean | null
          as_of_date: string | null
          batch_code: string | null
          first_inserted_at: string | null
          last_inserted_at: string | null
          malayalam_name: string | null
          max_snapshot_id: number | null
          min_snapshot_id: number | null
          product_id: number | null
          product_name: string | null
          qty_sum_raw: number | null
          qty_sum_uom_base: number | null
          qty_unit_norm: string | null
          qty_uom_base_unit: string | null
          row_count: number | null
          sku_id: number | null
          sku_label: string | null
          transfer_date: string | null
          transfer_godown_code: string | null
          transfer_godown_id: number | null
          transfer_godown_name: string | null
          transfer_region_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_tally_fg_transfer_event: {
        Row: {
          all_godown_mapped: boolean | null
          all_sku_mapped: boolean | null
          batch_code: string | null
          product_id: number | null
          product_name: string | null
          tally_breakdown_by_skuid: Json | null
          tally_breakdown_lines: Json | null
          tally_total_in_base: number | null
          tally_total_packs: number | null
          tally_uom_base_unit: string | null
          transfer_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_tally_fg_transfer_normalized: {
        Row: {
          alias_created_at: string | null
          alias_note: string | null
          as_of_date: string | null
          batch_code: string | null
          conversion_to_base: number | null
          id: number | null
          inserted_at: string | null
          is_godown_mapped: boolean | null
          is_sku_mapped: boolean | null
          item_alias_key_guess: string | null
          item_name_raw: string | null
          malayalam_name: string | null
          matched_alias_key: string | null
          matched_alias_text: string | null
          pack_size: number | null
          product_id: number | null
          product_name: string | null
          qty_in_uom_base: number | null
          qty_in_uom_base_unit: string | null
          qty_unit_key_guess: string | null
          qty_unit_norm: string | null
          qty_unit_text_raw: string | null
          qty_value_raw: number | null
          raw_godown_raw: string | null
          sku_id: number | null
          sku_is_active: boolean | null
          sku_label: string | null
          sku_pack_uom: string | null
          sku_status: string | null
          source_key: string | null
          transfer_date: string | null
          transfer_godown_code: string | null
          transfer_godown_code_norm: string | null
          transfer_godown_id: number | null
          transfer_godown_name: string | null
          transfer_region_id: number | null
          transfer_store_raw: string | null
          uom_base: string | null
        }
        Relationships: [
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_godown_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_rollup_month_region"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "godowns_region_id_fkey"
            columns: ["transfer_region_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_sales_enriched"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fg_bulk_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_fg_bulk_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_wip_rollup"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_bottled_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_bulk_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_storage_residuals"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_fg_wip_stock_by_product_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_picker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_bulk_soh"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_details"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_product_hierarchy"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_batches"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_wip_expected_output_base"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_mrp_plm_issue_monthly_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sdv_dim_sku"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_catalog_enriched"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_llt_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_picker"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_planning_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_plm_requirement_unit"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_seasonal_attrs"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_to_base_multiplier"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_sku_without_pack_format_map"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_aliases_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "v_stock_checker"
            referencedColumns: ["sku_id"]
          },
        ]
      }
      v_tally_net_cash_flow: {
        Row: {
          "Capital Inflow (Cr)": number | null
          "Capital Outflow (Dr)": number | null
          "Duties & Taxes Paid (Dr)": number | null
          "Duties & Taxes Received (Cr)": number | null
          "Loan Repayments (Dr)": number | null
          "Loans Received (Cr)": number | null
          Month: string | null
          "Net Cash Flow": number | null
          "Snapshot Date": string | null
        }
        Relationships: []
      }
      v_tally_net_cash_flow_latest: {
        Row: {
          "Capital Inflow (Cr)": number | null
          "Capital Outflow (Dr)": number | null
          "Duties & Taxes Paid (Dr)": number | null
          "Duties & Taxes Received (Cr)": number | null
          "Loan Repayments (Dr)": number | null
          "Loans Received (Cr)": number | null
          Month: string | null
          "Net Cash Flow": number | null
        }
        Relationships: []
      }
      v_tally_net_cash_flow_today: {
        Row: {
          "Capital Inflow (Cr)": number | null
          "Capital Outflow (Dr)": number | null
          "Duties & Taxes Paid (Dr)": number | null
          "Duties & Taxes Received (Cr)": number | null
          "Loan Repayments (Dr)": number | null
          "Loans Received (Cr)": number | null
          Month: string | null
          "Net Cash Flow": number | null
        }
        Relationships: []
      }
      v_tally_stock_items_distinct: {
        Row: {
          first_seen: string | null
          last_seen: string | null
          source_kind: string | null
          tally_item_name: string | null
        }
        Relationships: []
      }
      v_unmapped_stock_today: {
        Row: {
          as_of_date: string | null
          godown_label: string | null
          missing_godown_map: boolean | null
          missing_sku_map: boolean | null
          qty_units: number | null
          stock_value: number | null
          tally_item_name: string | null
        }
        Relationships: []
      }
      v_uom_picker: {
        Row: {
          id: number | null
          uom_code: string | null
        }
        Insert: {
          id?: number | null
          uom_code?: string | null
        }
        Update: {
          id?: number | null
          uom_code?: string | null
        }
        Relationships: []
      }
      v_user_permissions_effective: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          meta: Json | null
          target: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_upc_target"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "permission_targets"
            referencedColumns: ["key"]
          },
        ]
      }
      v_wip_batches: {
        Row: {
          activity: string | null
          batch_number: string | null
          batch_size: number | null
          batch_uom: string | null
          due_date: string | null
          item: string | null
          log_date: string | null
          no_product_match: boolean | null
          product_id: number | null
          started_on: string | null
        }
        Relationships: []
      }
      v_wip_expected_output_base: {
        Row: {
          activity: string | null
          base_output_uom: string | null
          batch_number: string | null
          batch_size: number | null
          batch_uom: string | null
          due_date: string | null
          expected_net_output_base: number | null
          item: string | null
          missing_batch_size: boolean | null
          no_bom_record: boolean | null
          no_product_match: boolean | null
          process_loss_null: boolean | null
          process_loss_pct: number | null
          product_id: number | null
          started_on: string | null
          uom_match: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_recent_permissions: {
        Args: { limit_count?: number }
        Returns: {
          can_edit: boolean
          can_view: boolean
          email: string
          label: string
          target: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_user_suggest: {
        Args: { limit_count: number; p_query: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      admin_users_for_target: {
        Args: { limit_count?: number; p_target_key: string }
        Returns: {
          can_edit: boolean
          can_view: boolean
          email: string
          label: string
          level: string
          target: string
          updated_at: string
          user_id: string
        }[]
      }
      allocate_kind_code: { Args: { p_name: string }; Returns: string }
      apply_manual_plan_set: {
        Args: {
          p_from: string
          p_set_id: number
          p_threshold?: number
          p_to: string
        }
        Returns: {
          deactivated_count: number
          inserted_count: number
          updated_count: number
        }[]
      }
      apply_production_batch_override_immediate: {
        Args: {
          p_batch_size: number
          p_bn: string
          p_header_id: number
          p_month_start: string
          p_note?: string
          p_op_type: Database["public"]["Enums"]["production_batch_op_type"]
          p_override_qty: number
          p_product_id: number
          p_uom: string
        }
        Returns: {
          inserted_count: number
          updated_count: number
        }[]
      }
      apply_production_batch_overrides: {
        Args: { p_from: string; p_to: string }
        Returns: {
          deactivated_count: number
          inserted_count: number
          updated_count: number
        }[]
      }
      apply_production_overrides: {
        Args: { p_from: string; p_to: string }
        Returns: {
          deactivated_count: number
          inserted_count: number
          updated_count: number
        }[]
      }
      approve_all_requests_for_user: {
        Args: {
          p_level?: Database["public"]["Enums"]["hub_access_level"]
          p_user_id: string
        }
        Returns: number
      }
      approve_hub_request: {
        Args: {
          p_level?: Database["public"]["Enums"]["hub_access_level"]
          p_request_id: number
        }
        Returns: undefined
      }
      approve_request_by_email_key: {
        Args: {
          p_email: string
          p_level?: Database["public"]["Enums"]["hub_access_level"]
          p_utility_key: string
        }
        Returns: undefined
      }
      base36: { Args: { n: number }; Returns: string }
      basename: { Args: { p: string }; Returns: string }
      build_batch_plan: {
        Args: { p_from: string; p_header_id: number; p_to: string }
        Returns: {
          inserted_batches: number
          inserted_lines: number
        }[]
      }
      build_preset_jobs: {
        Args: { p_ctx: Json; p_preset: string }
        Returns: Database["public"]["CompositeTypes"]["job_spec"][]
        SetofOptions: {
          from: "*"
          to: "job_spec"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      calc_fill_plan: {
        Args: {
          p_allow_overshoot: boolean
          p_bulk_base_qty: number
          p_debug?: boolean
          p_product_id: number
        }
        Returns: {
          benefit_per_base: number
          curr_mos: number
          fu_units_pm: number
          gap_mos: number
          mos: number
          region_code: string
          sku_id: number
          su_units: number
          um_base: number
          units_to_fill: number
          used_base_qty: number
        }[]
      }
      can_edit_plm_bom: { Args: never; Returns: boolean }
      check_daily_etl_health: {
        Args: never
        Returns: {
          details: Json
          message: string
          status: string
        }[]
      }
      cleanup_old_jobs: { Args: { p_days?: number }; Returns: number }
      clone_batch_plan: {
        Args: {
          p_header_id: number
          p_new_title: string
          p_with_lines?: boolean
        }
        Returns: number
      }
      compute_batches: {
        Args: { p_max: number; p_min: number; p_pref: number; p_total: number }
        Returns: {
          batch_count: number
          batch_sizes: number[]
          residual_qty: number
        }[]
      }
      compute_idempotency_key: {
        Args: { p_job_type: string; p_params: Json }
        Returns: string
      }
      config_text: { Args: { p_key: string }; Returns: string }
      count_forecast_exceptions_summary: {
        Args: {
          p_end: string
          p_include_unknown_mappings?: boolean
          p_start: string
          p_treat_zero_missing?: boolean
        }
        Returns: {
          missing_llt_relevant: number
          missing_month_rows: number
          missing_seasonal_relevant: number
        }[]
      }
      count_forecast_health_detailed: {
        Args: { p_end: string; p_start: string }
        Returns: {
          active_overrides_count: number
          missing_month_rows: number
          pairs_count: number
          pairs_missing_months: number
          pairs_with_12_months: number
          rows_count: number
          rows_per_month: Json
        }[]
      }
      count_forecast_health_mv: {
        Args: { p_end: string; p_start: string }
        Returns: {
          active_overrides_count: number
          missing_llt_relevant: number
          missing_seasonal_relevant: number
          pairs_count: number
          rows_count: number
        }[]
      }
      count_forecast_pairs: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      count_forecast_pairs_mv: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      count_publish_lines: { Args: { p_plan_id: number }; Returns: number }
      create_batch_plan_header: {
        Args: { p_from: string; p_title: string; p_to: string }
        Returns: number
      }
      current_run_key_ist: { Args: never; Returns: string }
      deactivate_forecast_override: {
        Args: {
          p_godown_id: number
          p_month_start: string
          p_region_id: number
          p_sku_id: number
        }
        Returns: boolean
      }
      deactivate_production_batch_override: {
        Args: {
          p_batch_size: number
          p_bn: string
          p_month_start: string
          p_op_type: Database["public"]["Enums"]["production_batch_op_type"]
          p_product_id: number
          p_uom: string
        }
        Returns: number
      }
      delete_publish: { Args: { p_plan_id: number }; Returns: Json }
      deny_hub_request: {
        Args: { p_reason: string; p_request_id: number }
        Returns: undefined
      }
      enqueue_all_daily_heavy: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_all_daily_light: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_capital_account_monthly_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_consumables_monthly_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_consumables_snapshot_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_fuel_snapshot_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_plm_snapshot_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_purchase_orders_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_rm_snapshot_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daily_stock_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_daybook_sales_day: {
        Args: {
          p_company: string
          p_date: string
          p_force?: boolean
          p_priority?: number
        }
        Returns: boolean
      }
      enqueue_daybook_sales_missing_fy: {
        Args: { p_company: string; p_priority?: number; p_target_date: string }
        Returns: number
      }
      enqueue_daybook_sales_range: {
        Args: {
          p_company: string
          p_end: string
          p_priority?: number
          p_start: string
        }
        Returns: number
      }
      enqueue_direct_expenses_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_duties_and_taxes_monthly_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_expenses_jobs: {
        Args: { p_company: string; p_date: string; p_group: string }
        Returns: undefined
      }
      enqueue_fg_transfer_ik_job: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_fg_transfer_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_fg_transfer_ok_job: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_forecast_job: {
        Args: {
          p_as_of_date?: string
          p_dry_run?: boolean
          p_job_type: string
          p_priority?: number
        }
        Returns: {
          job_id: string
          job_type: string
          queued_at: string
        }[]
      }
      enqueue_group_outstanding_creditors_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_group_outstanding_interunit_creditors_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_group_outstanding_jobs: {
        Args: { p_company: string; p_date: string; p_group: string }
        Returns: undefined
      }
      enqueue_group_outstanding_sundry_creditors_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_group_outstanding_sundry_debtors_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_indirect_expenses_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_job: {
        Args: {
          p_job_type: string
          p_not_before?: string
          p_params: Json
          p_priority?: number
        }
        Returns: string
      }
      enqueue_monthly_cashflow_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_monthly_group_summary_jobs: {
        Args: { p_company: string; p_date: string; p_group: string }
        Returns: undefined
      }
      enqueue_rm_pm_issues_missing_fy: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_rm_pm_issues_recent_window: {
        Args: { p_company: string; p_date: string; p_days: number }
        Returns: undefined
      }
      enqueue_secured_loans_monthly_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_storage_cleanup: { Args: { p_days?: number }; Returns: number }
      enqueue_storage_cleanup_jobs: {
        Args: { p_limit?: number }
        Returns: number
      }
      enqueue_storage_cleanup_jobs_500: { Args: never; Returns: number }
      enqueue_unsecured_loans_monthly_jobs: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_vreg_fetch_recent_window: {
        Args: {
          p_company: string
          p_date: string
          p_days: number
          p_force_refetch?: boolean
        }
        Returns: undefined
      }
      enqueue_vreg_purchases_missing_fy: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_vreg_purchases_recent_window: {
        Args: { p_company: string; p_date: string; p_days: number }
        Returns: undefined
      }
      enqueue_vreg_sales_missing_fy: {
        Args: { p_company: string; p_date: string }
        Returns: undefined
      }
      enqueue_vreg_sales_range: {
        Args: {
          p_company: string
          p_from: string
          p_skip_existing?: boolean
          p_to: string
        }
        Returns: undefined
      }
      enqueue_vreg_sales_recent_window: {
        Args: { p_company: string; p_date: string; p_days: number }
        Returns: undefined
      }
      f_norm_key: { Args: { input_text: string }; Returns: string }
      f_parse_sku_breakdown: {
        Args: { breakdown_text: string }
        Returns: {
          pack_qty: number
          pack_size: number
          pack_uom: string
        }[]
      }
      fetch_missing_relevant: {
        Args: {
          p_end: string
          p_kind?: string
          p_limit?: number
          p_offset?: number
          p_start: string
        }
        Returns: {
          conversion_to_base: number
          godown_id: number
          is_active: boolean
          item: string
          malayalam_name: string
          month_start: string
          pack_size: number
          product_id: number
          region_id: number
          sku_id: number
          sku_label: string
          status: string
          total_count: number
          uom: string
          uom_base: string
        }[]
      }
      fill_batch_plan_header: {
        Args: { p_header_id: number }
        Returns: undefined
      }
      fn_assert_is_plm_item: { Args: { p_item_id: number }; Returns: undefined }
      fn_bulk_upsert_item_class_map: {
        Args: { p_dry_run?: boolean; p_rows: Json }
        Returns: {
          action: string
          after: Json
          before: Json
          changed: boolean
          message: string
          ok: boolean
          out_stock_item_id: number
        }[]
      }
      fn_compute_next_review_on: {
        Args: { p_effective_from: string; p_policy_code: string }
        Returns: string
      }
      fn_consumption_monthly_filtered: {
        Args: {
          p_from_date?: string
          p_inv_stock_item_id: number
          p_to_date?: string
        }
        Returns: {
          consumable_out_qty: number | null
          inv_stock_item_id: number | null
          month_label: string | null
          month_start_date: string | null
          rm_pm_issue_qty: number | null
          source_kind: string | null
          total_consumed_qty: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_item_consumption_monthly_by_item"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_consumption_summary_count_filtered: {
        Args: {
          p_category_code: string
          p_from_date: string
          p_search: string
          p_source_kind: string
          p_to_date: string
        }
        Returns: {
          count: number
        }[]
      }
      fn_consumption_summary_filtered: {
        Args: {
          p_category_code: string
          p_from_date: string
          p_limit: number
          p_offset: number
          p_search: string
          p_source_kind: string
          p_to_date: string
        }
        Returns: {
          category_code: string
          code: string
          consumable_out_qty: number
          group_code: string
          inv_stock_item_id: number
          name: string
          rm_pm_issue_qty: number
          source_kind: string
          subcategory_code: string
          subgroup_code: string
          total_consumed_qty: number
        }[]
      }
      fn_fg_auto_zero: {
        Args: { p_batch_number: string; p_eps?: number; p_product_id: number }
        Returns: undefined
      }
      fn_fg_force_close: {
        Args: { p_user?: string; p_work_log_id: number }
        Returns: undefined
      }
      fn_fg_ledger_add: {
        Args: {
          p_batch_number: string
          p_movement_date?: string
          p_product_id: number
          p_qty_base: number
          p_reason: string
          p_ref_id: number
          p_ref_table: string
        }
        Returns: undefined
      }
      fn_fg_mark_done_if_zero: {
        Args: { p_batch_number: string; p_eps?: number; p_product_id: number }
        Returns: undefined
      }
      fn_fmt_group_suffix: { Args: { gid: number }; Returns: string }
      fn_plm_map_sku_to_template: {
        Args: { p_notes?: string; p_sku_id: number; p_tpl_id: number }
        Returns: undefined
      }
      fn_plm_rebuild_by_template: {
        Args: { p_tpl_id: number }
        Returns: number
      }
      fn_plm_rebuild_for_pack_format: {
        Args: { pf_id: number }
        Returns: undefined
      }
      fn_plm_rebuild_sku: { Args: { p_sku_id: number }; Returns: undefined }
      fn_plm_rebuild_skus_by_pack_format: {
        Args: { p_pack_format_id: number }
        Returns: undefined
      }
      fn_plm_upsert_override: {
        Args: {
          p_comp_ref: string
          p_is_optional: boolean
          p_op: string
          p_qty: number
          p_remarks: string
          p_sku_id: number
          p_uom_code: string
          p_wastage_pct: number
        }
        Returns: undefined
      }
      fn_plm_upsert_template: {
        Args: {
          p_code: string
          p_lines: Json
          p_notes: string
          p_process_loss_pct: number
          p_reference_qty: number
          p_reference_uom_code: string
        }
        Returns: {
          tpl_id: number
        }[]
      }
      fn_purchase_details_filtered: {
        Args: {
          p_from_date?: string
          p_inv_stock_item_id: number
          p_to_date?: string
        }
        Returns: {
          avg_rate_value: number | null
          billed_amount_value: number | null
          canonical_qty_value: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          godown_label: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          name: string | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          supplier_name: string | null
          tally_item_name: string | null
          voucher_date: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_purchases_by_item"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_purchase_summary_filtered: {
        Args: {
          p_category_code?: string
          p_from_date?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_source_kind?: string
          p_to_date?: string
        }
        Returns: {
          avg_purchase_rate: number | null
          category_code: string | null
          category_id: number | null
          category_label: string | null
          code: string | null
          group_code: string | null
          group_id: number | null
          group_label: string | null
          inv_stock_item_id: number | null
          last_purchase_date: string | null
          name: string | null
          purchase_lines: number | null
          source_kind: string | null
          subcategory_code: string | null
          subcategory_id: number | null
          subcategory_label: string | null
          subgroup_code: string | null
          subgroup_id: number | null
          subgroup_label: string | null
          total_purchased_qty: number | null
          total_purchased_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_purchases_summary_by_item"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_rm_bom_upsert: {
        Args: { p_header: Json; p_lines: Json; p_product_id: number }
        Returns: number
      }
      fn_run_mrp_rm_plan: {
        Args: {
          p_month_end: string
          p_month_start: string
          p_mrp_run_id: string
        }
        Returns: undefined
      }
      fn_stock_item_id: { Args: { p_code_or_name: string }; Returns: number }
      fn_uom_id: { Args: { p_code: string }; Returns: number }
      forecast_lock_acquire: { Args: never; Returns: boolean }
      forecast_lock_release: { Args: never; Returns: undefined }
      forecast_run_close: {
        Args: { p_notes?: string; p_run_id: number; p_status: string }
        Returns: undefined
      }
      forecast_run_open: {
        Args: {
          p_as_of_date: string
          p_frozen_after_day: number
          p_horizon_months: number
          p_module_slot: string
          p_notes?: string
        }
        Returns: number
      }
      forecast_upsert_monthly_base: {
        Args: { p_rows: Json; p_run_id: number }
        Returns: number
      }
      forecast_upsert_monthly_llt: {
        Args: { p_rows: Json; p_run_id: number }
        Returns: number
      }
      forecast_upsert_monthly_seasonal: {
        Args: { p_rows: Json; p_run_id: number }
        Returns: number
      }
      forecast_write_model_run: {
        Args: {
          p_metrics: Json
          p_model_key: string
          p_params: Json
          p_run_id: number
          p_slot: string
        }
        Returns: undefined
      }
      gen_item_code: { Args: never; Returns: string }
      get_admin_audit_logs: {
        Args: { limit_count?: number }
        Returns: {
          action_type: string
          admin_email: string
          admin_user_id: string
          created_at: string
          details: string
          id: number
          target_email: string
          target_user_id: string
        }[]
      }
      get_baseline_products: {
        Args: {
          _from?: string
          _godown_id?: number
          _region_id?: number
          _to?: string
        }
        Returns: {
          item: string
          product_id: number
        }[]
      }
      get_baseline_sku_ids: {
        Args: {
          _from?: string
          _godown_id?: number
          _region_id?: number
          _to?: string
        }
        Returns: {
          sku_id: number
        }[]
      }
      get_baseline_skus: {
        Args: {
          _from?: string
          _godown_id?: number
          _region_id?: number
          _to?: string
        }
        Returns: {
          sku_id: number
          sku_label: string
        }[]
      }
      get_inv_classification_hierarchy_json: { Args: never; Returns: Json }
      get_latest_batch_rule: {
        Args: { p_product_id: number; p_ref_date: string }
        Returns: {
          max_batch_size: number
          min_batch_size: number
          preferred_batch_size: number
        }[]
      }
      get_plan_worklist: {
        Args: { p_header_id: number }
        Returns: {
          batch_size: number
          bn: string
          category: string
          group: string
          malayalam: string
          product: string
          product_id: number
          status: string
          sub_category: string
          sub_group: string
          uom: string
        }[]
      }
      get_publish_lines: {
        Args: { p_page?: number; p_page_size?: number; p_plan_id: number }
        Returns: {
          demand_baseline: number
          godown_code: string
          godown_id: number
          item: string
          month_start: string
          pack_size: string
          region_code: string
          region_id: number
          sku_id: number
          supply_final: number
          supply_llt: number
          supply_seasonal: number
          uom: string
        }[]
      }
      get_stock_item_category_code: {
        Args: { p_item_id: number }
        Returns: string
      }
      get_stock_item_default_dimension_id: {
        Args: { p_item_id: number }
        Returns: number
      }
      get_stock_items_by_classification: {
        Args: {
          p_category_id?: number
          p_group_id?: number
          p_limit?: number
          p_offset?: number
          p_subcategory_id?: number
          p_subgroup_id?: number
        }
        Returns: {
          active: boolean
          code: string
          default_uom_id: number
          full_count: number
          id: number
          name: string
          notes: string
        }[]
      }
      get_uom_dimension_id: { Args: { p_uom_id: number }; Returns: number }
      get_user_permissions: { Args: { p_user_id: string }; Returns: Json }
      hub_request_access: {
        Args: { p_note?: string; p_utility_slug: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_etl_admin: { Args: { p_user: string }; Returns: boolean }
      list_etl_presets: {
        Args: never
        Returns: {
          hints: string
          label: string
          preset_key: string
        }[]
      }
      list_hub_access_by_email: {
        Args: { p_email: string }
        Returns: {
          level: Database["public"]["Enums"]["hub_access_level"]
          updated_at: string
          user_id: string
          utility_id: string
          utility_key: string
          utility_label: string
        }[]
      }
      list_overrides_for_header: {
        Args: { p_header_id: number }
        Returns: {
          batch_size: number
          bn: string
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          month_start: string
          note: string | null
          op_type: Database["public"]["Enums"]["production_batch_op_type"]
          override_qty: number | null
          product_id: number
          uom: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "production_batch_overrides"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_admin_action: {
        Args: {
          action_details?: string
          action_type: string
          admin_id: string
          target_id?: string
        }
        Returns: number
      }
      log_daily_etl_health: { Args: never; Returns: undefined }
      manual_vs_system_reco: {
        Args: { p_from: string; p_set_id: number; p_to: string }
        Returns: {
          delta_qty: number
          manual_qty: number
          month_start: string
          product_id: number
          product_name: string
          reason: string
          system_qty: number
        }[]
      }
      map_batch_to_bmr: {
        Args: { p_batch_id: number; p_bmr_id: number }
        Returns: undefined
      }
      map_batch_to_bmr_by_bn: {
        Args: { p_batch_id: number; p_bn: string }
        Returns: undefined
      }
      map_plan_batch_to_bmr: {
        Args: { p_batch_id: number; p_bmr_id: number; p_user?: string }
        Returns: undefined
      }
      map_plan_batch_to_bnr_by_bn: {
        Args: { p_batch_id: number; p_bn: string }
        Returns: undefined
      }
      marketing_baseline_export: {
        Args: { p_asof?: string; p_horizon?: number }
        Returns: {
          delta_units: number
          demand_baseline: number
          demand_baseline_effective: number
          godown_id: number
          month_start: string
          region_id: number
          sku_id: number
        }[]
      }
      marketing_plan_export: {
        Args: { p_asof?: string; p_horizon?: number }
        Returns: {
          demand_baseline_effective: number
          godown_id: number
          month_start: string
          region_id: number
          sku_id: number
          supply_final: number
          supply_llt: number
          supply_seasonal: number
        }[]
      }
      maybe_push_stock_today: { Args: never; Returns: string }
      mk_kind_code: { Args: { p_name: string }; Returns: string }
      mrp_material_overview_page: {
        Args: {
          p_alloc?: boolean
          p_horizon_start: string
          p_material_kind?: string
          p_mode?: string
          p_modes?: string[]
          p_netpos?: boolean
          p_noplan?: boolean
          p_over?: boolean
          p_page_index?: number
          p_page_size?: number
          p_pni?: boolean
          p_q?: string
          p_view?: string
        }
        Returns: Json
      }
      mrp_plm_fill_plan_rebuild_range_fast: {
        Args: {
          p_debug?: boolean
          p_delete_existing?: boolean
          p_end: string
          p_product_ids?: number[]
          p_start: string
        }
        Returns: {
          bulk_base_qty: number
          mode_used: string
          out_horizon_end: string
          out_horizon_start: string
          out_product_id: number
          remainder_base_qty: number
          rows_deleted: number
          rows_inserted: number
          skus_count: number
          used_base_qty: number
        }[]
      }
      mrp_plm_issue_lines_ingest_range: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: number
      }
      mrp_plm_rebuild_all: {
        Args: { p_horizon_start: string }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          items_changed: number
          items_seen: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_plm_rebuild_dry_run_all: {
        Args: { p_horizon_start: string }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          stock_item_id: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_plm_rebuild_for_item: {
        Args: {
          p_dry_run?: boolean
          p_horizon_start: string
          p_stock_item_id: number
        }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          stock_item_id: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_pm_allocation_console: {
        Args: {
          p_horizon_start: string
          p_limit?: number
          p_offset?: number
          p_only_approx?: boolean
          p_only_unassigned?: boolean
          p_q?: string
          p_stock_item_id?: number
        }
        Returns: Json
      }
      mrp_pm_issue_lines_save: { Args: { p_changes: Json }; Returns: Json }
      mrp_rm_allocation_console: {
        Args: {
          p_horizon_start: string
          p_limit: number
          p_offset: number
          p_only_approx: boolean
          p_only_unassigned: boolean
          p_q: string
          p_stock_item_id: number
        }
        Returns: Json
      }
      mrp_rm_issue_lines_ingest_range: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: number
      }
      mrp_rm_issue_lines_save: { Args: { p_changes: Json }; Returns: Json }
      mrp_rm_overlay_season_build: {
        Args: {
          p_activate?: boolean
          p_built_by?: string
          p_notes?: string
          p_plan_end: string
          p_plan_start: string
        }
        Returns: {
          detail_rows: number
          overlay_run_id: string
          plan_end: string
          plan_start: string
        }[]
      }
      mrp_rm_overlay_season_run_summary: {
        Args: { p_overlay_run_id: string }
        Returns: Json
      }
      mrp_rm_plan_rebuild_month: {
        Args: { p_month_start: string }
        Returns: number
      }
      mrp_rm_plan_rebuild_month_active: {
        Args: { p_built_by?: string; p_month_start: string; p_notes?: string }
        Returns: {
          month_start: string
          mrp_run_id: string
          rows_inserted: number
        }[]
      }
      mrp_rm_plan_rebuild_range: {
        Args: { p_end_month: string; p_start_month: string }
        Returns: {
          month_start: string
          rows_inserted: number
        }[]
      }
      mrp_rm_plan_rebuild_range_active: {
        Args: {
          p_built_by: string
          p_end_month: string
          p_notes: string
          p_start_month: string
        }
        Returns: {
          month_start: string
          mrp_run_id: string
          rm_items: number
        }[]
      }
      mrp_rm_rebuild_all: {
        Args: { p_horizon_start: string }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          items_changed: number
          items_seen: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_rm_rebuild_all_erp: {
        Args: {
          p_built_by?: string
          p_end_month?: string
          p_horizon_start: string
          p_notes?: string
        }
        Returns: {
          allocations: Json
          horizon_end: string
          horizon_start: string
          plan_end: string
          plan_runs: Json
          plan_start: string
        }[]
      }
      mrp_rm_rebuild_dry_run_all: {
        Args: { p_horizon_start: string }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          stock_item_id: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_rm_rebuild_for_item: {
        Args: {
          p_dry_run?: boolean
          p_horizon_start: string
          p_stock_item_id: number
        }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          stock_item_id: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      mrp_rm_rebuild_plan_range_active: {
        Args: {
          p_built_by?: string
          p_end_month: string
          p_notes?: string
          p_start_month: string
        }
        Returns: {
          month_start: string
          mrp_run_id: string
          rows_inserted: number
        }[]
      }
      mrp_rm_reclassify_issue_allocations_month: {
        Args: { p_dry_run?: boolean; p_horizon_start: string }
        Returns: {
          approx_after: number
          approx_before: number
          horizon_end: string
          horizon_start: string
          issue_lines_affected: number
          issue_lines_total: number
          unassigned_after: number
          unassigned_before: number
        }[]
      }
      normalise_alias_key: { Args: { p: string }; Returns: string }
      normalize_key: { Args: { p: string }; Returns: string }
      normalize_target_key: { Args: { p_key: string }; Returns: string }
      nudge_small_residuals: {
        Args: { p_header_id: number; p_threshold_pct?: number }
        Returns: number
      }
      plm_requirement_for_fill_plan: {
        Args: { p_bulk_base_qty: number; p_product_id: number }
        Returns: {
          qty_required_total: number
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
        }[]
      }
      plm_sku_bom_effective: {
        Args: { p_sku_id: number }
        Returns: {
          is_optional: boolean
          is_override: boolean
          qty_per_reference_output: number
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      preflight_and_enqueue_daily:
        | { Args: { p_company: string; p_date: string }; Returns: string }
        | {
            Args: { p_company: string; p_date: string; p_mode: string }
            Returns: string
          }
      preflight_and_enqueue_daily_heavy: {
        Args: { p_date: string }
        Returns: string
      }
      preflight_and_enqueue_daily_light: {
        Args: { p_date: string }
        Returns: string
      }
      process_supply_rollup_refresh: { Args: never; Returns: undefined }
      promote_all_staging: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      publish_plan_snapshot: {
        Args: {
          p_as_of_date: string
          p_filters?: Json
          p_from: string
          p_notes: string
          p_plan_key: string
          p_to: string
        }
        Returns: Json
      }
      push_stock_snapshot_from_aliases: {
        Args: { p_date: string }
        Returns: number
      }
      rebuild_batch_plan: {
        Args: { p_header_id: number }
        Returns: {
          batches_replaced: number
          lines_inserted: number
          lines_updated: number
        }[]
      }
      rebuild_batch_plan_unmapped: {
        Args: { p_header_id: number }
        Returns: {
          updated_batches: number
          updated_lines: number
        }[]
      }
      rebuild_unmapped_only: { Args: { p_header_id: number }; Returns: number }
      recalc_batch_plan_for_product: {
        Args: { p_header_id: number; p_product_id: number }
        Returns: {
          updated_batches: number
          updated_lines: number
        }[]
      }
      refresh_batch_plan: { Args: { p_header_id: number }; Returns: undefined }
      refresh_batch_plan_lines: {
        Args: { p_header_id: number; p_product_ids: number[] }
        Returns: undefined
      }
      refresh_mv_forecast_plan_12m: { Args: never; Returns: undefined }
      refresh_sales_monthly: { Args: never; Returns: undefined }
      refresh_sales_monthly_both: { Args: never; Returns: undefined }
      refresh_supply_rollups: { Args: never; Returns: undefined }
      resolve_user_name: { Args: { p_uid: string }; Returns: string }
      retry_jobs_by_ids: { Args: { p_job_ids: string[] }; Returns: number }
      revoke_user_access: {
        Args: { p_user_id: string; p_utility_key: string }
        Returns: undefined
      }
      rollback_manual_plan_apply: {
        Args: { p_from?: string; p_set_id?: number; p_to?: string }
        Returns: number
      }
      rpc_cancel_jobs: { Args: { p_job_ids: string[] }; Returns: number }
      rpc_conversion_summary_search: {
        Args: {
          p_end?: string
          p_page?: number
          p_per_page?: number
          p_search?: string
          p_start?: string
        }
        Returns: {
          row_data: Json
          total_count: number
        }[]
      }
      rpc_enqueue_job: {
        Args: { p_job_type: string; p_params: Json; p_priority?: number }
        Returns: string
      }
      rpc_forecast_exceptions: {
        Args: {
          p_end: string
          p_godown_id?: number
          p_include_unknown_mappings?: boolean
          p_page?: number
          p_page_size?: number
          p_region_id?: number
          p_sku_id?: number
          p_start: string
          p_treat_zero_missing?: boolean
        }
        Returns: Json
      }
      rpc_get_rm_items: {
        Args: never
        Returns: {
          id: number
          name: string
        }[]
      }
      rpc_incomplete_pairs: {
        Args: {
          p_end: string
          p_page?: number
          p_page_size?: number
          p_start: string
        }
        Returns: Json
      }
      rpc_overlay_monthly_search: {
        Args: {
          p_end?: string
          p_only_nonzero?: boolean
          p_page?: number
          p_per_page?: number
          p_run_id?: string
          p_search?: string
          p_start?: string
        }
        Returns: {
          row_data: Json
          total_count: number
        }[]
      }
      rpc_plm_bom_get_header: {
        Args: { p_sku_id: number }
        Returns: {
          last_updated_at: string
          process_loss_pct: number
          reference_output_qty: number
          reference_output_uom_code: string
          reference_output_uom_id: number
          sku_id: number
        }[]
      }
      rpc_plm_bom_list_lines: {
        Args: { p_sku_id: number }
        Returns: {
          is_optional: boolean
          line_no: number
          qty_per_reference_output: number
          remarks: string
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      rpc_plm_map_clear: { Args: { p_sku_id: number }; Returns: undefined }
      rpc_plm_map_get_for_sku: {
        Args: { p_sku_id: number }
        Returns: {
          tpl_code: string
          tpl_id: number
        }[]
      }
      rpc_plm_map_set: {
        Args: { p_sku_id: number; p_tpl_id: number }
        Returns: undefined
      }
      rpc_plm_override_counts: {
        Args: never
        Returns: {
          total_skus: number
          with_overrides: number
          without_overrides: number
        }[]
      }
      rpc_plm_ovr_delete: { Args: { p_id: number }; Returns: undefined }
      rpc_plm_ovr_list: {
        Args: { p_sku_id: number }
        Returns: {
          id: number
          is_optional: boolean
          op: string
          qty_per_reference_output: number
          remarks: string
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      rpc_plm_ovr_upsert: {
        Args: {
          p_id: number
          p_is_optional?: boolean
          p_op: string
          p_qty: number
          p_remarks?: string
          p_sku_id: number
          p_stock_item_id: number
          p_uom_code: string
          p_wastage_pct?: number
        }
        Returns: number
      }
      rpc_plm_preview_effective: {
        Args: { p_sku_id: number }
        Returns: {
          is_optional: boolean
          qty_per_reference_output: number
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      rpc_plm_rebuild_all:
        | {
            Args: { p_dry_run?: boolean }
            Returns: {
              action: string
              sku_id: number
            }[]
          }
        | {
            Args: { p_dry_run?: boolean; p_limit?: number; p_offset?: number }
            Returns: {
              action: string
              sku_id: number
            }[]
          }
      rpc_plm_rebuild_sku: { Args: { p_sku_id: number }; Returns: undefined }
      rpc_plm_rebuild_skus_for_tpl: {
        Args: { p_tpl_id: number }
        Returns: number
      }
      rpc_plm_tpl_delete_line: {
        Args: { p_line_id: number }
        Returns: undefined
      }
      rpc_plm_tpl_list_lines: {
        Args: { p_tpl_id: number }
        Returns: {
          is_optional: boolean
          line_id: number
          line_no: number
          qty_per_reference_output: number
          remarks: string
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      rpc_plm_tpl_renumber: { Args: { p_tpl_id: number }; Returns: undefined }
      rpc_plm_tpl_upsert_header: {
        Args: {
          p_code: string
          p_process_loss_pct?: number
          p_ref_uom_code: string
          p_reference_output_qty: number
        }
        Returns: number
      }
      rpc_plm_tpl_upsert_line: {
        Args: {
          p_is_optional?: boolean
          p_qty: number
          p_remarks?: string
          p_stock_item_id: number
          p_tpl_id: number
          p_uom_code: string
          p_wastage_pct?: number
        }
        Returns: number
      }
      rpc_procurement_plan_search: {
        Args: {
          p_end?: string
          p_material_kind?: string
          p_only_net?: boolean
          p_page?: number
          p_per_page?: number
          p_search?: string
          p_start?: string
        }
        Returns: {
          row_data: Json
          total_count: number
        }[]
      }
      rpc_retry_failed: {
        Args: { p_from: string; p_job_type: string; p_to: string }
        Returns: number
      }
      rpc_run_master_aggregator: {
        Args: { p_company?: string; p_date: string }
        Returns: string
      }
      rpc_skus_without_overrides: {
        Args: never
        Returns: {
          sku_id: number
          sku_label: string
        }[]
      }
      rpc_sp_bom_delete_line: {
        Args: {
          p_owner_item_id: number
          p_stock_item_id: number
          p_uom_code: string
        }
        Returns: undefined
      }
      rpc_sp_bom_get_header: {
        Args: { p_owner_item_id: number }
        Returns: {
          id: number
          notes: string
          owner_item_id: number
          process_loss_pct: number
          reference_output_qty: number
          reference_output_uom: string
          reference_output_uom_id: number
        }[]
      }
      rpc_sp_bom_list_lines: {
        Args: { p_owner_item_id: number }
        Returns: {
          is_optional: boolean
          line_id: number
          line_no: number
          qty_per_reference_output: number
          remarks: string
          stock_item_id: number
          stock_item_name: string
          uom_code: string
          uom_id: number
          wastage_pct: number
        }[]
      }
      rpc_sp_bom_renumber: {
        Args: { p_owner_item_id: number }
        Returns: undefined
      }
      rpc_sp_bom_upsert_header: {
        Args: {
          p_notes?: string
          p_owner_item_id: number
          p_process_loss_pct: number
          p_reference_output_qty: number
          p_reference_output_uom: string
        }
        Returns: number
      }
      rpc_sp_bom_upsert_line: {
        Args: {
          p_is_optional?: boolean
          p_owner_item_id: number
          p_qty: number
          p_remarks?: string
          p_stock_item_id: number
          p_uom_code: string
          p_wastage_pct?: number
        }
        Returns: undefined
      }
      rpc_trace_search: {
        Args: {
          p_end?: string
          p_material_kind?: string
          p_page?: number
          p_per_page?: number
          p_search?: string
          p_start?: string
        }
        Returns: {
          row_data: Json
          total_count: number
        }[]
      }
      sdv_zero_revenue_abs: {
        Args: {
          p_active_only?: boolean
          p_anchor_date: string
          p_godown_id?: number
          p_months: number
          p_region_id?: number
        }
        Returns: {
          is_active: boolean
          product_id: number
          product_name: string
          sku_id: number
        }[]
      }
      sdv_zero_sellers_abs: {
        Args: {
          p_active_only?: boolean
          p_anchor_date: string
          p_godown_id?: number
          p_months: number
          p_region_id?: number
        }
        Returns: {
          is_active: boolean
          product_id: number
          product_name: string
          sku_id: number
        }[]
      }
      seed_manual_plan_set: {
        Args: {
          p_from: string
          p_note?: string
          p_set_id: number
          p_to: string
        }
        Returns: number
      }
      set_marketing_export_months: {
        Args: { p_months: number }
        Returns: undefined
      }
      set_user_access_by_email_key: {
        Args: {
          p_email: string
          p_level: Database["public"]["Enums"]["hub_access_level"]
          p_utility_key: string
        }
        Returns: undefined
      }
      sop_approval_decide: {
        Args: {
          p_comments?: string
          p_decision: Database["public"]["Enums"]["approval_status"]
          p_revision_id: string
          p_role_id: string
        }
        Returns: undefined
      }
      sop_next_seq: { Args: { p_series: string }; Returns: number }
      sop_publish_approved: {
        Args: { p_effective_date?: string; p_revision_id: string }
        Returns: undefined
      }
      sop_sections_resequence: {
        Args: { p_revision_id: string }
        Returns: undefined
      }
      sop_sections_reset_to_template: {
        Args: { p_revision_id: string }
        Returns: number
      }
      sop_submit_for_review: {
        Args: { p_revision_id: string }
        Returns: undefined
      }
      stock_checker_query: {
        Args: {
          p_filters: Json
          p_page?: number
          p_page_size?: number
          p_sort_col?: string
          p_sort_dir?: string
        }
        Returns: Json
      }
      unmapped_aggregate: { Args: { p_filters: Json }; Returns: Json }
      unmapped_rows: {
        Args: {
          p_filters: Json
          p_page?: number
          p_page_size?: number
          p_sort_col?: string
          p_sort_dir?: string
        }
        Returns: Json
      }
      upsert_forecast_override: {
        Args: {
          p_created_by?: string
          p_delta_units: number
          p_godown_id: number
          p_is_active?: boolean
          p_month_start: string
          p_reason?: string
          p_region_id: number
          p_sku_id: number
          p_source?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          delta_units: number
          godown_id: number
          id: number
          is_active: boolean
          month_start: string
          reason: string | null
          region_id: number
          sku_id: number
          source: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "forecast_demand_overrides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_godown_alias: {
        Args: { p_alias: string; p_godown_id: number; p_note?: string }
        Returns: undefined
      }
      upsert_godown_stock_snapshot: {
        Args: { p_date: string; p_godown_code: string; p_rows: Json }
        Returns: number
      }
      upsert_sku_alias: {
        Args: { p_alias: string; p_note?: string; p_sku_id: number }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      hub_access_level: "none" | "view" | "use"
      job_status: "queued" | "in_progress" | "done" | "error"
      production_batch_op_type: "ADD" | "RESIZE" | "CANCEL"
      sop_change_type: "new" | "minor" | "major" | "emergency"
      sop_status:
        | "draft"
        | "under_review"
        | "approved"
        | "active"
        | "superseded"
        | "obsolete"
    }
    CompositeTypes: {
      job_spec: {
        job_type: string | null
        params: Json | null
      }
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
      approval_status: ["pending", "approved", "rejected"],
      hub_access_level: ["none", "view", "use"],
      job_status: ["queued", "in_progress", "done", "error"],
      production_batch_op_type: ["ADD", "RESIZE", "CANCEL"],
      sop_change_type: ["new", "minor", "major", "emergency"],
      sop_status: [
        "draft",
        "under_review",
        "approved",
        "active",
        "superseded",
        "obsolete",
      ],
    },
  },
} as const
