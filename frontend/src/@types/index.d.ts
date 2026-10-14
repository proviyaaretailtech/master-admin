import type { FeaturePermission, SecurityRole } from "../api/role.api";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  status?: string;
  role_id?: string | null;
  role_name?: string;
  role_key?: string;
  role_scope?: string;
  role_details?: SecurityRole | null;
  permissions?: FeaturePermission[];
  isSuperAdmin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  /** Access-token expiry, seconds since the epoch. */
  expiresAt?: number | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedUsersResponse {
  message: string;
  users: User[];
  pagination: Pagination;
}

export interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
  errorCode?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface Organization {
  id: string;
  business_name: string;
  domain: string;
  status: "Active" | "Inactive" | "Pending" | "Suspended" | string;
  email: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationPayload {
  business_name: string;
  domain: string;
  email: string;
  phone_number: string;
  status?: string;
}

export interface UpdateOrganizationPayload {
  business_name?: string;
  domain?: string;
  email?: string;
  phone_number?: string;
  status?: string;
}

export interface GetOrganizationsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  domain?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc" | "ASC" | "DESC";
}

export interface PaginatedOrganizationsResponse {
  message: string;
  organizations: Organization[];
  pagination: Pagination;
}

export interface LocationItem {
  id: string;
  org_id: string;
  name: string;
  area?: string | null;
  code?: string | null;
  type: string;
  status: "Active" | "Pending" | "Inactive" | "Draft" | string;
  time_zone?: string;
  timeZone?: string;
  currency?: string;
  last_sync?: string;
  lastSync?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLocationPayload {
  name: string;
  area?: string | null;
  code?: string | null;
  type?: string;
  status?: string;
  timeZone?: string;
  time_zone?: string;
  currency?: string;
}

export interface UpdateLocationPayload {
  name?: string;
  area?: string | null;
  code?: string | null;
  type?: string;
  status?: string;
  timeZone?: string;
  time_zone?: string;
  currency?: string;
}

export interface PaginatedLocationsResponse {
  message: string;
  locations: LocationItem[];
  organization?: {
    id: string;
    business_name: string;
    domain: string;
  };
  pagination: Pagination;
}
