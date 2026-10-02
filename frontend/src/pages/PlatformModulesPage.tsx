import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Filter,
  Layers,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  moduleApi,
  PlatformModuleItem,
  CreatePlatformModuleInput,
  UpdatePlatformModuleInput,
} from "../api/module.api";
import { usePermissions } from "../hooks/use-permissions";
import { useFormat } from "../i18n/useFormat";
import { statusLabel, toCode } from "../i18n/labels";
import { localizeError } from "../i18n/errors";

export const PlatformModulesPage: React.FC = () => {
  const { can } = usePermissions();
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const canManageModules = can("feat_commercial_plans", "manage_modules");

  const [modules, setModules] = useState<PlatformModuleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState<PlatformModuleItem | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Core");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [moduleToDelete, setModuleToDelete] = useState<PlatformModuleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Categories are free text typed by admins; known ones are shown in the user's language,
  // anything else is shown exactly as typed.
  const categoryLabel = (raw: string) => {
    const key = `modules.category.${toCode(raw)}`;
    return i18n.exists(key) ? t(key) : raw;
  };

  const fetchModules = async () => {
    setIsLoading(true);
    try {
      const res = await moduleApi.getAll();
      setModules(res.modules || []);
    } catch {
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const openCreateModal = () => {
    setEditingModule(null);
    setFormKey("");
    setFormName("");
    setFormCategory("Core");
    setFormDescription("");
    setFormIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (mod: PlatformModuleItem) => {
    setEditingModule(mod);
    setFormKey(mod.key);
    setFormName(mod.name);
    setFormCategory(mod.category || "Core");
    setFormDescription(mod.description || "");
    setFormIsActive(mod.is_active);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formName.trim()) {
      setToastMessage(t("modules.toast.keyAndNameRequired"));
      return;
    }
    if (formKey.trim().length > 6) {
      setToastMessage(t("modules.toast.keyTooLong"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingModule) {
        const payload: UpdatePlatformModuleInput = {
          name: formName.trim(),
          category: formCategory.trim() || "Core",
          description: formDescription.trim(),
          is_active: formIsActive,
        };
        const res = await moduleApi.update(editingModule.id, payload);
        setModules((prev) =>
          prev.map((m) => (m.id === editingModule.id ? { ...m, ...res.module } : m))
        );
        setToastMessage(t("modules.toast.updated", { name: res.module.name }));
      } else {
        const payload: CreatePlatformModuleInput = {
          key: formKey.trim().toUpperCase(),
          name: formName.trim(),
          category: formCategory.trim() || "Core",
          description: formDescription.trim(),
          is_active: formIsActive,
        };
        const res = await moduleApi.create(payload);
        setModules((prev) => [...prev, res.module]);
        setToastMessage(t("modules.toast.created", { name: res.module.name }));
      }
      setShowModal(false);
    } catch (err: unknown) {
      setToastMessage(localizeError(err, "modules.toast.saveFailed"));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!moduleToDelete) return;
    setIsDeleting(true);
    try {
      await moduleApi.delete(moduleToDelete.id);
      setModules((prev) => prev.filter((m) => m.id !== moduleToDelete.id));
      setToastMessage(t("modules.toast.deleted", { name: moduleToDelete.name }));
      setModuleToDelete(null);
    } catch (err: unknown) {
      setToastMessage(localizeError(err, "modules.toast.deleteFailed"));
    } finally {
      setIsDeleting(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const categories = ["All", ...Array.from(new Set(modules.map((m) => m.category || "Core")))];

  const filteredModules = modules.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "All" || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-[min(28rem,calc(100vw-2rem))] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Breadcrumbs */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800">
          {t("modules.breadcrumb.master")}
        </Link>
        <span>/</span>
        <Link to="/commercials/plans" className="hover:text-slate-800">
          {t("modules.breadcrumb.commercials")}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-bold">{t("modules.title")}</span>
      </nav>

      {/* 2. Top Tabs: Plans & Modules Navigation */}
      <div className="flex border-b border-slate-200 gap-8 text-sm font-semibold">
        <Link
          to="/commercials/plans"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors"
        >
          {t("modules.tabs.plans")}
        </Link>
        <Link
          to="/commercials/modules"
          className="pb-3 border-b-2 border-emerald-600 text-slate-900 transition-colors"
        >
          {t("modules.title")}
        </Link>
      </div>

      {/* 3. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t("modules.title")}
            </h1>
            {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">{t("modules.subtitle")}</p>
        </div>

        {canManageModules && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("modules.actions.create")}</span>
          </button>
        )}
      </div>

      {/* 4. Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t("modules.filter.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold px-1">
            <Filter className="w-3.5 h-3.5" />
            <span>{t("modules.filter.category")}</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? t("common.all") : categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Modules Table / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">{t("modules.loading")}</p>
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{t("modules.empty.title")}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || categoryFilter !== "All"
                ? t("modules.empty.filtered")
                : t("modules.empty.none")}
            </p>
            {canManageModules && !searchQuery && categoryFilter === "All" && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("modules.actions.createFirst")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider [&:lang(hi)]:tracking-normal text-slate-500">
                  <th className="py-3.5 px-5">{t("modules.table.name")}</th>
                  <th className="py-3.5 px-4">{t("modules.table.key")}</th>
                  <th className="py-3.5 px-4">{t("modules.table.category")}</th>
                  <th className="py-3.5 px-4">{t("modules.table.status")}</th>
                  <th className="py-3.5 px-4">{t("modules.table.bundledIn")}</th>
                  <th className="py-3.5 px-4">{t("modules.table.created")}</th>
                  {canManageModules && (
                    <th className="py-3.5 px-5 text-right">{t("modules.table.actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredModules.map((mod) => (
                  <tr key={mod.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Description */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-sm">{mod.name}</div>
                      {mod.description && (
                        <div className="text-slate-500 text-[11px] mt-0.5 max-w-md">
                          {mod.description}
                        </div>
                      )}
                    </td>

                    {/* Key */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 uppercase">
                        {mod.key}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4">
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {categoryLabel(mod.category || "Core")}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {mod.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#EAF7DB] text-[#2B7000] border border-[#CDE7B2]">
                          {statusLabel(t, "Active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {statusLabel(t, "Inactive")}
                        </span>
                      )}
                    </td>

                    {/* Bundled in Plans */}
                    <td className="py-4 px-4">
                      <span
                        className={`font-semibold ${
                          (mod.plans_count || 0) > 0 ? "text-[#15803D]" : "text-slate-500"
                        }`}
                      >
                        {t("modules.plansCount", {
                          count: mod.plans_count || 0,
                          n: f.number(mod.plans_count || 0),
                        })}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-4 px-4 whitespace-nowrap text-slate-500">
                      {f.date(mod.created_at)}
                    </td>

                    {/* Actions */}
                    {canManageModules && (
                      <td className="py-4 px-5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(mod)}
                            title={t("modules.actions.edit")}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setModuleToDelete(mod)}
                            title={t("modules.actions.delete")}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Create / Edit Module Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingModule
                  ? t("modules.modal.editTitle", { name: editingModule.name })
                  : t("modules.modal.createTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                  {t("modules.modal.nameLabel")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("modules.modal.namePlaceholder")}
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!editingModule && !formKey) {
                      setFormKey(
                        e.target.value
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .slice(0, 6)
                          .toUpperCase()
                      );
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                  {t("modules.modal.keyLabel")}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  disabled={!!editingModule}
                  placeholder={t("modules.modal.keyPlaceholder")}
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toUpperCase().slice(0, 6))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {t("modules.modal.keyHint")}
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                  {t("modules.modal.categoryLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t("modules.modal.categoryPlaceholder")}
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                  {t("modules.modal.descriptionLabel")}
                </label>
                <textarea
                  rows={2}
                  placeholder={t("modules.modal.descriptionPlaceholder")}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="formIsActive" className="text-xs font-semibold text-slate-700">
                  {t("modules.modal.activeLabel")}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? t("common.saving")
                    : editingModule
                      ? t("modules.actions.update")
                      : t("modules.actions.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {moduleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">{t("modules.actions.delete")}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <Trans
                i18nKey="modules.delete.confirm"
                components={{
                  name: (
                    <strong className="text-slate-800">&quot;{moduleToDelete.name}&quot;</strong>
                  ),
                  modkey: <span className="font-mono text-slate-700">{moduleToDelete.key}</span>,
                }}
              />
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModuleToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? t("modules.delete.deleting") : t("modules.actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformModulesPage;
