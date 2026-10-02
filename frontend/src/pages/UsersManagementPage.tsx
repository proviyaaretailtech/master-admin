import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/use-auth";
import { usePermissions } from "../hooks/use-permissions";
import { userApi } from "../api";
import { roleApi, SecurityRole } from "../api/role.api";
import { User, Pagination } from "../@types";
import { useFormat } from "../i18n/useFormat";
import { statusLabel, toCode } from "../i18n/labels";
import { localizeError } from "../i18n/errors";
import {
  Search,
  ChevronDown,
  X,
  Trash2,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Shield,
} from "lucide-react";

export const UsersManagementPage: React.FC = () => {
  const { user: currentAuthUser } = useAuth();
  const { can } = usePermissions();
  const { t, i18n } = useTranslation();
  const f = useFormat();

  // Role scopes come from the API as words ("One organization"); show known ones in the user's
  // language and anything else exactly as the server sent it.
  const scopeLabel = (raw: string) => {
    const key = `users.roleScope.${toCode(raw)}`;
    return i18n.exists(key) ? t(key) : raw;
  };

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<SecurityRole[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 9,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("All Security Roles");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Statuses");
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalForm, setModalForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    role_id: "" as string,
    status: "Active" as "Active" | "Inactive",
  });
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load available security roles for dropdown
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await roleApi.getAll();
        if (res && Array.isArray(res.roles)) {
          setAvailableRoles(res.roles);
        }
      } catch (err) {
        console.warn("Could not fetch security roles:", err);
      }
    };
    fetchRoles();
  }, []);

  // Fetch paginated users from Backend
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userApi.getAll({
        page: currentPage,
        limit: 9,
        search: searchTerm,
        role_id: selectedRoleFilter !== "All Security Roles" ? selectedRoleFilter : undefined,
        status: selectedStatusFilter,
      });

      setUsers(response.users || []);
      setPagination(
        response.pagination || {
          total: response.users?.length || 0,
          page: currentPage,
          limit: 9,
          totalPages: Math.max(1, Math.ceil((response.users?.length || 0) / 9)),
        }
      );
    } catch (err) {
      console.error("Failed to load users from database:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Debounced load when search or filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  // Open Edit Modal
  const handleOpenEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setModalForm({
      first_name: targetUser.first_name || "",
      last_name: targetUser.last_name || "",
      email: targetUser.email || "",
      phone_number: targetUser.phone_number === "-" ? "" : targetUser.phone_number || "",
      role_id: targetUser.role_id || "",
      status: (targetUser.status as "Active" | "Inactive") || "Active",
    });
    setModalOpen(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  // Save changes from modal directly to Backend DB
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    setFeedbackMessage(null);

    try {
      await userApi.update(editingUser.id, {
        first_name: modalForm.first_name.trim(),
        last_name: modalForm.last_name.trim(),
        email: modalForm.email.trim(),
        phone_number: modalForm.phone_number.trim() || "-",
        role_id: modalForm.role_id ? modalForm.role_id : null,
        status: modalForm.status,
      });

      setFeedbackMessage(t("users.edit.updated"));
      setTimeout(() => {
        setFeedbackMessage(null);
        handleCloseModal();
        loadUsers();
      }, 700);
    } catch (err: any) {
      alert(t("users.alerts.updateFailed", { message: localizeError(err) }));
    } finally {
      setSaving(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!editingUser) return;
    if (editingUser.id === currentAuthUser?.id) {
      alert(t("users.alerts.cannotDeleteSelf"));
      return;
    }
    if (!window.confirm(t("users.alerts.confirmDelete", { email: editingUser.email }))) {
      return;
    }

    try {
      await userApi.delete(editingUser.id);
      handleCloseModal();
      loadUsers();
    } catch (err: any) {
      alert(t("users.alerts.deleteFailed", { message: localizeError(err) }));
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* ============================================================== */}
      {/* 1. TOP FILTER CONTROLS BAR                                     */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input with magnifying glass */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t("users.search.placeholder")}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none placeholder:text-slate-400 shadow-2xs"
          />
        </div>

        {/* Dropdown: Security Roles Filter */}
        <div className="relative">
          <select
            value={selectedRoleFilter}
            onChange={(e) => {
              setSelectedRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-9 text-xs text-slate-700 font-medium focus:border-[#65D000] outline-none shadow-2xs cursor-pointer"
          >
            <option value="All Security Roles">{t("users.filter.allRoles")}</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* Dropdown: All Statuses */}
        <div className="relative">
          <select
            value={selectedStatusFilter}
            onChange={(e) => {
              setSelectedStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-9 text-xs text-slate-700 font-medium focus:border-[#65D000] outline-none shadow-2xs cursor-pointer"
          >
            <option value="All Statuses">{t("users.filter.allStatuses")}</option>
            <option value="Active">{statusLabel(t, "Active")}</option>
            <option value="Inactive">{statusLabel(t, "Inactive")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* Refresh button */}
        <button
          onClick={loadUsers}
          disabled={loading}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          title={t("users.refreshTitle")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN DATA TABLE CARD                                        */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header: Title & Subtitle */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-snug">
              {t("users.list.title")}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{t("users.list.subtitle")}</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFB] text-slate-500 uppercase text-[10px] tracking-wider [&:lang(hi)]:tracking-normal border-b border-slate-100 font-bold">
              <tr>
                <th className="px-6 py-3.5">{t("users.table.email")}</th>
                <th className="px-6 py-3.5">{t("users.table.securityRole")}</th>
                <th className="px-6 py-3.5">{t("users.table.mobile")}</th>
                <th className="px-6 py-3.5">{t("users.table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#65D000] border-t-transparent" />
                      <span>{t("users.table.loading")}</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                    {t("users.table.empty")}
                  </td>
                </tr>
              ) : (
                users.map((item) => {
                  const canEdit = can("feat_users_mgmt", "edit_user");
                  const roleDisplayName =
                    item.role_details?.name ||
                    item.role_name ||
                    (item.role_id
                      ? t("users.table.assignedRole")
                      : t("users.table.noRoleAssigned"));
                  const rawRoleScope = item.role_details?.scope || item.role_scope;
                  const roleScope = rawRoleScope
                    ? scopeLabel(rawRoleScope)
                    : item.role_id
                      ? t("users.table.activePolicy")
                      : t("users.table.unassigned");

                  return (
                    <tr
                      key={item.id}
                      onClick={canEdit ? () => handleOpenEditModal(item) : undefined}
                      className={`hover:bg-slate-50/70 transition-colors ${canEdit ? "cursor-pointer" : ""}`}
                      title={canEdit ? t("users.table.editRowTitle") : undefined}
                    >
                      {/* EMAIL Column */}
                      <td className="px-6 py-4 font-bold text-slate-900 text-xs sm:text-sm">
                        {item.email}
                      </td>

                      {/* SECURITY ROLE Column */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{roleDisplayName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 ml-5">{roleScope}</div>
                      </td>

                      {/* MOBILE Column */}
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {item.phone_number || "-"}
                      </td>

                      {/* STATUS Column */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            (item.status || "Active") === "Active"
                              ? "bg-[#EAF8E6] text-[#2E7D32]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {statusLabel(t, item.status || "Active")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card Footer: Results Count + Pagination */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            {t("users.results", {
              from: f.number(pagination.total === 0 ? 0 : startIndex),
              to: f.number(endIndex),
              total: f.number(pagination.total),
            })}
          </div>

          {/* Pagination Box */}
          <div className="flex items-center border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-2xs gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="text-slate-400 hover:text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                disabled={loading}
                className={`font-semibold cursor-pointer ${
                  currentPage === pageNum
                    ? "text-slate-900 font-bold"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {f.number(pageNum)}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage >= pagination.totalPages || loading}
              className="text-slate-400 hover:text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. EDIT ACCOUNT MODAL                                          */}
      {/* ============================================================== */}
      {modalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("users.edit.title")}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t("users.edit.subtitle")}</p>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Feedback Toast */}
            {feedbackMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">{feedbackMessage}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("users.form.firstName")}
                  </label>
                  <input
                    type="text"
                    value={modalForm.first_name}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                    placeholder={t("users.form.firstName")}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("users.form.lastName")}
                  </label>
                  <input
                    type="text"
                    value={modalForm.last_name}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                    placeholder={t("users.form.lastName")}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("users.form.emailAddress")}
                </label>
                <input
                  type="email"
                  value={modalForm.email}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none font-medium"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("users.form.mobileNumber")}
                </label>
                <input
                  type="tel"
                  value={modalForm.phone_number}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, phone_number: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#65D000] focus:ring-1 focus:ring-[#65D000]/20 transition-all outline-none"
                />
              </div>

              {/* Security Role & Status Row (Zero panel/role dropdowns) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("users.form.securityRole")}
                  </label>
                  <select
                    value={modalForm.role_id}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, role_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#65D000] outline-none cursor-pointer"
                  >
                    <option value="">{t("users.form.noRoleOption")}</option>
                    {availableRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {t("users.form.roleOption", { name: r.name, scope: scopeLabel(r.scope) })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("common.status")}
                  </label>
                  <select
                    value={modalForm.status}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        status: e.target.value as "Active" | "Inactive",
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#65D000] outline-none cursor-pointer"
                  >
                    <option value="Active">{statusLabel(t, "Active")}</option>
                    <option value="Inactive">{statusLabel(t, "Inactive")}</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {can("feat_users_mgmt", "delete_user") && (
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("users.edit.deleteUser")}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {t("common.cancel")}
                  </button>

                  {can("feat_users_mgmt", "edit_user") && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#65D000] hover:bg-[#58b800] text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? t("common.saving") : t("users.edit.saveChanges")}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
