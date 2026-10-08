import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { invitationApi } from "../../api/organization-ops.api";
import { roleApi } from "../../api/role.api";
import { usePermissions } from "../../hooks/use-permissions";
import { FEAT } from "../../lib/master-features";
import { useFormat } from "../../i18n/useFormat";
import {
  Button,
  DataTable,
  ErrorBox,
  FilterBar,
  Modal,
  Notice,
  PageHeader,
  PageState,
  Pager,
  ReasonDialog,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../components/master/ui";
import { useMasterScope } from "../../components/master/MasterContext";
import { useAction, useResource } from "../../components/master/useResource";
import type { Invitation } from "../../api/organization-ops.api";

export const InvitationsPage: React.FC = () => {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = usePermissions();
  const scope = useMasterScope();
  const canInvite = can(FEAT.USERS.id, FEAT.USERS.invite);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ organization_id: "", email: "", role_slug: "" });
  const action = useAction();

  const res = useResource(
    () => invitationApi.list({ org: scope.orgId, status, page }),
    [scope.orgId, status, page]
  );
  const roles = useResource(() => roleApi.getAll({}), [], { enabled: creating });

  const rows = res.data?.items ?? [];

  const create = async () => {
    const r = await action.run(() => invitationApi.create(form));
    if (r !== undefined) {
      setCreating(false);
      setNotice(t("m.invitations.sent"));
      res.reload();
    }
  };
  const resend = async (i: Invitation) => {
    const r = await action.run(() => invitationApi.resend(i.id));
    if (r !== undefined) setNotice(t("m.invitations.resent", { email: i.email }));
  };
  const revoke = async () => {
    if (!revoking) return;
    const r = await action.run(() => invitationApi.revoke(revoking.id));
    if (r !== undefined) {
      setRevoking(null);
      setNotice(t("m.invitations.revoked"));
      res.reload();
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.organization")}
        title={t("m.invitations.title")}
        subtitle={t("m.invitations.subtitle")}
        actions={
          canInvite && (
            <Button
              variant="primary"
              onClick={() => {
                setForm({ organization_id: scope.orgId, email: "", role_slug: "" });
                action.clear();
                setCreating(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("m.invitations.invite")}
            </Button>
          )
        }
      />
      {notice && (
        <div className="mb-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      {!creating && !revoking && action.error ? (
        <div className="mb-3">
          <ErrorBox error={action.error} />
        </div>
      ) : null}
      <FilterBar>
        <SelectInput
          label={t("common.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{t("common.all")}</option>
          {["pending", "accepted", "revoked", "expired"].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </SelectInput>
      </FilterBar>
      <PageState
        loading={res.loading}
        error={res.error}
        denied={res.denied}
        onRetry={res.reload}
        empty={rows.length === 0}
        emptyText={t("m.invitations.empty")}
      >
        <DataTable
          caption={t("m.invitations.title")}
          rows={rows}
          rowKey={(i) => i.id}
          columns={[
            { key: "e", header: t("common.email"), render: (i) => i.email },
            {
              key: "o",
              header: t("m.invitations.organization"),
              render: (i) => i.organization_name ?? i.organization_id,
            },
            { key: "r", header: t("m.invitations.role"), render: (i) => i.role_slug },
            {
              key: "s",
              header: t("common.status"),
              render: (i) => <StatusBadge code={i.status} />,
            },
            {
              key: "d",
              header: t("common.date"),
              render: (i) => (i.created_at ? f.date(i.created_at) : t("common.dash")),
            },
            {
              key: "a",
              header: t("common.actions"),
              render: (i) =>
                canInvite && i.status === "pending" ? (
                  <span className="flex gap-2">
                    <Button
                      onClick={() => resend(i)}
                      aria-label={t("m.invitations.resendFor", { email: i.email })}
                    >
                      {t("m.invitations.resend")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        action.clear();
                        setRevoking(i);
                      }}
                      aria-label={t("m.invitations.revokeFor", { email: i.email })}
                    >
                      {t("m.invitations.revoke")}
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} onPage={setPage} />
      </PageState>

      <Modal
        open={creating}
        title={t("m.invitations.invite")}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              busy={action.busy}
              disabled={!form.organization_id || !form.email.trim() || !form.role_slug}
              onClick={create}
            >
              {t("m.invitations.send")}
            </Button>
          </>
        }
      >
        <SelectInput
          label={t("m.invitations.organization")}
          value={form.organization_id}
          onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
        >
          <option value="">{t("m.invitations.chooseOrg")}</option>
          {(scope.context?.organizations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label={t("common.email")}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <SelectInput
          label={t("m.invitations.role")}
          value={form.role_slug}
          onChange={(e) => setForm({ ...form, role_slug: e.target.value })}
        >
          <option value="">{t("m.invitations.chooseRole")}</option>
          {(roles.data?.roles ?? []).map((r) => (
            <option key={r.id} value={r.key}>
              {r.name}
            </option>
          ))}
        </SelectInput>
        {action.error ? <ErrorBox error={action.error} /> : null}
      </Modal>
      <ReasonDialog
        open={revoking !== null}
        required={false}
        danger
        title={t("m.invitations.revokeTitle")}
        description={t("m.invitations.revokeBody", { email: revoking?.email ?? "" })}
        confirmLabel={t("m.invitations.revoke")}
        busy={action.busy}
        error={action.error}
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
};
