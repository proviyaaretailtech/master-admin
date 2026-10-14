import { apiClient } from "../lib/api-client";

export type AccessLevel = "none" | "read_only" | "full";

export interface GranularAction {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export type FeatureCategory =
  | "commercials"
  | "partner_detail"
  | "organization"
  | "access_control"
  | "system"
  | "operations"
  | "finance"
  | "platform";

export interface FeaturePermission {
  id: string;
  name: string;
  category: FeatureCategory;
  pagePath: string;
  description: string;
  accessLevel: AccessLevel;
  actions: GranularAction[];
}

export interface SecurityRole {
  id: string;
  name: string;
  key: string;
  scope: string;
  description: string;
  status: "Active" | "Inactive";
  isActive: boolean;
  isSystem?: boolean;
  assignedCount: number;
  assignedText: string;
  features: FeaturePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  key: string;
  scope: string;
  description: string;
  isActive: boolean;
  features: FeaturePermission[];
}

export interface UpdateRolePayload {
  name?: string;
  scope?: string;
  description?: string;
  isActive?: boolean;
  features?: FeaturePermission[];
}

export interface GetRolesParams {
  search?: string;
  scope?: string;
}

export const roleApi = {
  /**
   * Fetch all roles with optional search and scope filter
   */
  async getAll(params: GetRolesParams = {}): Promise<{ roles: SecurityRole[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params.search && params.search.trim()) {
      queryParams.set("search", params.search.trim());
    }
    if (params.scope && params.scope !== "All Scopes" && params.scope.trim()) {
      queryParams.set("scope", params.scope.trim());
    }

    const queryString = queryParams.toString();
    const url = queryString ? `/roles?${queryString}` : "/roles";

    const response = await apiClient.get<{ message: string; roles: SecurityRole[]; total: number }>(
      url
    );
    return response.data;
  },

  /**
   * Every feature and action a role can be granted (the backend permission registry), all off.
   * The role editor builds its matrix from this.
   */
  async getCatalog(): Promise<{ message: string; features: FeaturePermission[] }> {
    const response = await apiClient.get<{ message: string; features: FeaturePermission[] }>(
      "/roles/catalog"
    );
    return response.data;
  },

  /**
   * Fetch single role by UUID
   */
  async getById(id: string): Promise<{ message: string; role: SecurityRole }> {
    const response = await apiClient.get<{ message: string; role: SecurityRole }>(`/roles/${id}`);
    return response.data;
  },

  /**
   * Create a new role
   */
  async create(payload: CreateRolePayload): Promise<{ message: string; role: SecurityRole }> {
    const response = await apiClient.post<{ message: string; role: SecurityRole }>(
      "/roles",
      payload
    );
    return response.data;
  },

  /**
   * Update role details and permission matrix
   */
  async update(
    id: string,
    payload: UpdateRolePayload
  ): Promise<{ message: string; role: SecurityRole }> {
    const response = await apiClient.put<{ message: string; role: SecurityRole }>(
      `/roles/${id}`,
      payload
    );
    return response.data;
  },

  /**
   * Delete custom role
   */
  async delete(id: string): Promise<{ message: string; id: string }> {
    const response = await apiClient.delete<{ message: string; id: string }>(`/roles/${id}`);
    return response.data;
  },
};
