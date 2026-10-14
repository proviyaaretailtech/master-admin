import { apiClient } from "../lib/api-client";
import { AuthResponse, User } from "../@types";

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  /**
   * Sign in existing user with email and password
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/login", payload);
    return response.data;
  },

  /**
   * Sign out: "local" ends this session, "global" ends every session of the account (sign out
   * everywhere). The backend also clears the refresh cookie.
   */
  async logout(scope: "local" | "global" = "local"): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>("/auth/logout", { scope });
    return response.data;
  },

  /**
   * Emails a password reset link. The answer is the same whether or not the address has an account.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>("/auth/forgot-password", { email });
    return response.data;
  },

  /**
   * Sets a new password with the recovery token from the emailed link.
   */
  async resetPassword(accessToken: string, password: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>("/auth/reset-password", {
      accessToken,
      password,
    });
    return response.data;
  },

  /**
   * Fetch currently authenticated user profile
   */
  async getMe(): Promise<{ message: string; user: User }> {
    const response = await apiClient.get<{ message: string; user: User }>("/auth/me");
    return response.data;
  },
};
