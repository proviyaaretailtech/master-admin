# Database changes for Proviyaa Master

Claude writes these files; **a founder reviews and applies them**. Claude only reads the live database.
The live record of applied changes is `public.schema_migrations_ledger` (highest before this folder: `0570`).

| File | What it does | Undo file |
|---|---|---|
| `0600_platform_approvals.sql` | Layer 1A: platform approvals, approval limits (₹500 / ₹5,000 / ₹10,000), Controller and Backup Controller escalation. Partner-side refunds are unchanged. | `0600_platform_approvals.rollback.sql` |

## How to apply a change (about 5 minutes)

**This changes the live database. Do it at a quiet time, and read the "What it does" box at the top of the file first.**

1. Open **supabase.com** (type the address yourself) and open your project.
2. In the left menu, click **SQL Editor**, then **New query**.
3. Open the **apply** file, the one **without** `.rollback` in its name (for 0600: `0600_platform_approvals.sql`; its first lines say "APPLY FILE"), in Notepad, press **Ctrl + A**, **Ctrl + C**, then click into the SQL Editor and press **Ctrl + V**.
4. Click **Run** (bottom right).
5. **What you should see:** "Success. No rows returned" (or a single row from the last line). If you see an error, nothing was changed — the whole file runs as one unit. Copy the error message (it contains no secrets) and send it to Claude.

## Check that 0600 worked

Paste and run this in a **new** query:

```sql
select action_type, min_minor / 100 as from_rupees, max_minor / 100 as to_rupees, approver_roles, backup_roles
from public.platform_approval_tiers order by action_type, min_minor;
```

You should see **6 rows**: three for refund, two for ledger_adjustment, one for payout_release.

## Undo

Run the matching `.rollback.sql` file the same way. It refuses to run if any platform approval request already exists, so approval history is never lost.

## After applying 0600

To use the Approvals screens, give people the new permissions in Master → **Roles & Permissions** → "Approvals & Approval Limits":

- Finance staff: *View Approvals* + *Approve as Finance*
- Controller: *View Approvals* + *Approve as Controller*
- Backup Controller: *View Approvals* + *Approve as Backup Controller*
- Anyone who raises requests: *Request Approval*

Founders (super admins) can change the approval limits; nobody else can, even with the permission.
