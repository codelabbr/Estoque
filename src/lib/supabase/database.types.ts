// Gerado por scripts/gen-db-types.mts (pnpm db:types) — não edite à mão.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          organization_id: string | null;
          record_id: string | null;
          table_name: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          record_id?: string | null;
          table_name?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          record_id?: string | null;
          table_name?: string | null;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          archived_at: string | null;
          cpf: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          hired_at: string | null;
          id: string;
          job_role_id: string | null;
          organization_id: string;
          phone: string | null;
          photo_path: string | null;
          registration: string | null;
          sector_id: string | null;
          terminated_at: string | null;
          unit_id: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          cpf: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          hired_at?: string | null;
          id?: string;
          job_role_id?: string | null;
          organization_id: string;
          phone?: string | null;
          photo_path?: string | null;
          registration?: string | null;
          sector_id?: string | null;
          terminated_at?: string | null;
          unit_id?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          cpf?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          hired_at?: string | null;
          id?: string;
          job_role_id?: string | null;
          organization_id?: string;
          phone?: string | null;
          photo_path?: string | null;
          registration?: string | null;
          sector_id?: string | null;
          terminated_at?: string | null;
          unit_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_organization_id_job_role_id_fkey";
            columns: ["organization_id", "job_role_id"];
            isOneToOne: false;
            referencedRelation: "job_roles";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "employees_organization_id_sector_id_fkey";
            columns: ["organization_id", "sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "employees_organization_id_unit_id_fkey";
            columns: ["organization_id", "unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      epi_variants: {
        Row: {
          archived_at: string | null;
          created_at: string;
          epi_id: string;
          id: string;
          min_stock: number;
          organization_id: string;
          size_label: string;
          sku: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          epi_id: string;
          id?: string;
          min_stock?: number;
          organization_id: string;
          size_label?: string;
          sku?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          epi_id?: string;
          id?: string;
          min_stock?: number;
          organization_id?: string;
          size_label?: string;
          sku?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "epi_variants_organization_id_epi_id_fkey";
            columns: ["organization_id", "epi_id"];
            isOneToOne: false;
            referencedRelation: "epis";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "epi_variants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      epis: {
        Row: {
          archived_at: string | null;
          ca_expires_at: string | null;
          ca_number: string | null;
          category: Database["public"]["Enums"]["epi_category"];
          created_at: string;
          id: string;
          lifespan_days: number | null;
          manufacturer: string | null;
          model: string | null;
          name: string;
          organization_id: string;
          photo_path: string | null;
          reference_cost: number | null;
          unit_of_measure: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          ca_expires_at?: string | null;
          ca_number?: string | null;
          category: Database["public"]["Enums"]["epi_category"];
          created_at?: string;
          id?: string;
          lifespan_days?: number | null;
          manufacturer?: string | null;
          model?: string | null;
          name: string;
          organization_id: string;
          photo_path?: string | null;
          reference_cost?: number | null;
          unit_of_measure?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          ca_expires_at?: string | null;
          ca_number?: string | null;
          category?: Database["public"]["Enums"]["epi_category"];
          created_at?: string;
          id?: string;
          lifespan_days?: number | null;
          manufacturer?: string | null;
          model?: string | null;
          name?: string;
          organization_id?: string;
          photo_path?: string | null;
          reference_cost?: number | null;
          unit_of_measure?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "epis_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      job_role_epi_requirements: {
        Row: {
          epi_id: string;
          job_role_id: string;
          organization_id: string;
          quantity: number;
        };
        Insert: {
          epi_id: string;
          job_role_id: string;
          organization_id: string;
          quantity?: number;
        };
        Update: {
          epi_id?: string;
          job_role_id?: string;
          organization_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_role_epi_requirements_organization_id_epi_id_fkey";
            columns: ["organization_id", "epi_id"];
            isOneToOne: false;
            referencedRelation: "epis";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "job_role_epi_requirements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_role_epi_requirements_organization_id_job_role_id_fkey";
            columns: ["organization_id", "job_role_id"];
            isOneToOne: false;
            referencedRelation: "job_roles";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      job_role_training_requirements: {
        Row: {
          job_role_id: string;
          organization_id: string;
          training_type_id: string;
        };
        Insert: {
          job_role_id: string;
          organization_id: string;
          training_type_id: string;
        };
        Update: {
          job_role_id?: string;
          organization_id?: string;
          training_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_role_training_requirement_organization_id_training_typ_fkey";
            columns: ["organization_id", "training_type_id"];
            isOneToOne: false;
            referencedRelation: "training_types";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "job_role_training_requirements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_role_training_requirements_organization_id_job_role_id_fkey";
            columns: ["organization_id", "job_role_id"];
            isOneToOne: false;
            referencedRelation: "job_roles";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      job_roles: {
        Row: {
          archived_at: string | null;
          cbo: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          archived_at?: string | null;
          cbo?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          archived_at?: string | null;
          cbo?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          daily_digest: boolean;
          organization_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          daily_digest?: boolean;
          organization_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_digest?: boolean;
          organization_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          alert_days_ca: number;
          alert_days_epi: number;
          alert_days_training: number;
          cnpj: string | null;
          created_at: string;
          id: string;
          legal_name: string | null;
          logo_path: string | null;
          name: string;
          plan: string;
          responsibility_term: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          alert_days_ca?: number;
          alert_days_epi?: number;
          alert_days_training?: number;
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name: string;
          plan?: string;
          responsibility_term?: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          alert_days_ca?: number;
          alert_days_epi?: number;
          alert_days_training?: number;
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name?: string;
          plan?: string;
          responsibility_term?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sectors: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          unit_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          unit_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sectors_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sectors_organization_id_unit_id_fkey";
            columns: ["organization_id", "unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      stock_locations: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
          unit_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
          unit_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_locations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_locations_organization_id_unit_id_fkey";
            columns: ["organization_id", "unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          batch: string | null;
          batch_expires_at: string | null;
          created_at: string;
          created_by: string | null;
          delivery_item_id: string | null;
          direction: number;
          document_ref: string | null;
          group_id: string | null;
          id: string;
          location_id: string;
          occurred_on: string;
          organization_id: string;
          quantity: number;
          reason: string | null;
          reverses_id: string | null;
          signed_quantity: number | null;
          supplier: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost: number | null;
          variant_id: string;
        };
        Insert: {
          batch?: string | null;
          batch_expires_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_item_id?: string | null;
          direction: number;
          document_ref?: string | null;
          group_id?: string | null;
          id?: string;
          location_id: string;
          occurred_on?: string;
          organization_id: string;
          quantity: number;
          reason?: string | null;
          reverses_id?: string | null;
          signed_quantity?: never;
          supplier?: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost?: number | null;
          variant_id: string;
        };
        Update: {
          batch?: string | null;
          batch_expires_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_item_id?: string | null;
          direction?: number;
          document_ref?: string | null;
          group_id?: string | null;
          id?: string;
          location_id?: string;
          occurred_on?: string;
          organization_id?: string;
          quantity?: number;
          reason?: string | null;
          reverses_id?: string | null;
          signed_quantity?: never;
          supplier?: string | null;
          type?: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_location_id_fkey";
            columns: ["organization_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_variant_id_fkey";
            columns: ["organization_id", "variant_id"];
            isOneToOne: false;
            referencedRelation: "epi_variants";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_reverses_id_fkey";
            columns: ["reverses_id"];
            isOneToOne: true;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
        ];
      };
      training_types: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          regulation: string | null;
          validity_months: number | null;
          workload_hours: number | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          regulation?: string | null;
          validity_months?: number | null;
          workload_hours?: number | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          regulation?: string | null;
          validity_months?: number | null;
          workload_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_stock_balance: {
        Row: {
          avg_cost: number | null;
          balance: number | null;
          below_min: boolean | null;
          last_entry_on: string | null;
          location_id: string | null;
          min_stock: number | null;
          organization_id: string | null;
          variant_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      adjust_stock: {
        Args: {
          p_org: string;
          p_location: string;
          p_variant: string;
          p_delta: number;
          p_reason: string;
        };
        Returns: string;
      };
      apply_inventory: {
        Args: {
          p_org: string;
          p_location: string;
          p_counts: Json;
          p_reason: string;
        };
        Returns: Json;
      };
      assert_active_location: {
        Args: {
          p_org: string;
          p_location: string;
        };
        Returns: undefined;
      };
      assert_active_variant: {
        Args: {
          p_org: string;
          p_variant: string;
        };
        Returns: undefined;
      };
      assert_can_operate_stock: {
        Args: {
          p_org: string;
        };
        Returns: undefined;
      };
      create_epi: {
        Args: {
          p_org: string;
          p_epi: Json;
          p_sizes?: string[];
        };
        Returns: string;
      };
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_legal_name?: string;
          p_cnpj?: string;
        };
        Returns: {
          alert_days_ca: number;
          alert_days_epi: number;
          alert_days_training: number;
          cnpj: string | null;
          created_at: string;
          id: string;
          legal_name: string | null;
          logo_path: string | null;
          name: string;
          plan: string;
          responsibility_term: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      discard_stock: {
        Args: {
          p_org: string;
          p_location: string;
          p_variant: string;
          p_quantity: number;
          p_reason: string;
        };
        Returns: string;
      };
      has_org_role: {
        Args: {
          p_org: string;
          p_roles?: Database["public"]["Enums"]["org_role"][];
        };
        Returns: boolean;
      };
      import_employees: {
        Args: {
          p_org: string;
          p_rows: Json;
        };
        Returns: Json;
      };
      list_org_members: {
        Args: {
          p_org: string;
        };
        Returns: {
          user_id: string;
          email: string;
          role: Database["public"]["Enums"]["org_role"];
          created_at: string;
        }[];
      };
      lock_stock_balance: {
        Args: {
          p_location: string;
          p_variant: string;
        };
        Returns: number;
      };
      register_stock_entry: {
        Args: {
          p_org: string;
          p_location: string;
          p_items: Json;
          p_supplier?: string;
          p_document_ref?: string;
          p_occurred_on?: string;
        };
        Returns: string;
      };
      reverse_stock_movement: {
        Args: {
          p_movement: string;
          p_reason: string;
        };
        Returns: string;
      };
      sao_paulo_today: {
        Args: never;
        Returns: string;
      };
      seed_training_types: {
        Args: {
          p_org: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      epi_category: "cabeca" | "olhos_face" | "auditiva" | "respiratoria" | "tronco" | "membros_superiores" | "membros_inferiores" | "corpo_inteiro" | "quedas" | "outro";
      org_role: "owner" | "admin" | "safety" | "storekeeper" | "viewer";
      stock_movement_type: "entrada" | "saida_entrega" | "devolucao" | "descarte" | "ajuste_positivo" | "ajuste_negativo" | "transferencia_entrada" | "transferencia_saida" | "estorno";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      epi_category: ["cabeca", "olhos_face", "auditiva", "respiratoria", "tronco", "membros_superiores", "membros_inferiores", "corpo_inteiro", "quedas", "outro"],
      org_role: ["owner", "admin", "safety", "storekeeper", "viewer"],
      stock_movement_type: ["entrada", "saida_entrega", "devolucao", "descarte", "ajuste_positivo", "ajuste_negativo", "transferencia_entrada", "transferencia_saida", "estorno"],
    },
  },
} as const;
