import i18n from "i18next";
import { ApiError, isApiError } from "../lib/api-error";

/**
 * Turns anything thrown by the API layer into text in the user's language.
 *
 * Order:
 *  1. network failure                      -> errors.network
 *  2. known server message (exact/pattern) -> errors.server.<slug>   (backend sends one errorCode
 *     for many different messages, so the message table is more specific than the code)
 *  3. known errorCode                      -> errors.code.<CODE> (for the shared "bucket" codes
 *     VALIDATION_ERROR etc. an untranslated server message is shown as-is in English, and as
 *     "<localized summary> (<server message>)" in other languages)
 *  4. unknown code / no code, has message  -> the server's own message, unchanged
 *  5. only an HTTP status                  -> errors.status.<status>
 *  6. anything else                        -> errors.generic (or the caller's fallback key)
 *
 * When the backend adds a specific errorCode for a message, add `errors.code.<CODE>` to the
 * catalogue and the row below can be deleted.
 */

type ParamFn = (m: RegExpMatchArray) => Record<string, string>;
const value: ParamFn = (m) => ({ value: m[1] });

const SERVER_MESSAGES: Array<[RegExp, string, ParamFn?]> = [
  [/^Invalid email or password\.?$/i, "invalidCredentials"],
  [/^This account does not have access to the control plane$/i, "noControlPlaneAccess"],
  [/^User account has been deactivated or suspended$/i, "accountDeactivated"],
  [
    /^(Not authenticated|Authentication token is missing|Authentication required to access this resource)$/i,
    "notAuthenticated",
  ],
  [/^Invalid or expired authentication token$/i, "sessionExpired"],
  [/^An organization with email '(.*)' already exists$/i, "orgEmailExists", value],
  [/^An organization with phone number '(.*)' already exists$/i, "orgPhoneExists", value],
  [/^Email '(.*)' is already in use by another organization$/i, "orgEmailInUse", value],
  [/^Phone number '(.*)' is already in use by another organization$/i, "orgPhoneInUse", value],
  [/^This organization has orders or payments and cannot be deleted\./i, "orgHasOrders"],
  [/^Organization with ID '.*' (not found|does not exist)$/i, "orgNotFound"],
  [/^Location .*not found/i, "locationNotFound"],
  [
    /^A location with code '(.*)' already exists in this organization$/i,
    "locationCodeExists",
    value,
  ],
  [/^A location with this code already exists in this organization$/i, "locationCodeExistsGeneric"],
  [/^This location has orders and cannot be deleted\./i, "locationHasOrders"],
  [/^Commercial plan not found$/i, "planNotFound"],
  [/^Plan with code '(.*)' already exists$/i, "planCodeExists", value],
  [/^Cannot delete plan with active tenant subscriptions\./i, "planHasSubscriptions"],
  [/^Cannot delete a plan that has tenant subscription history\./i, "planHasHistory"],
  [/^Commercial pack with ID '.*' was not found$/i, "packNotFound"],
  [/^A commercial pack with code '(.*)' already exists$/i, "packCodeExists", value],
  [/^Commercial add-on with ID '.*' was not found$/i, "addonNotFound"],
  [/^A commercial add-on with code '(.*)' already exists$/i, "addonCodeExists", value],
  [/^Maximum quantity cannot be lower than the minimum quantity$/i, "quantityRange"],
  [/^Platform module not found$/i, "moduleNotFound"],
  [/^Module with key '(.*)' already exists$/i, "moduleKeyExists", value],
  [/^User not found$/i, "userNotFound"],
  [/^Security role with ID '.*' (was not found|does not exist)$/i, "roleNotFound"],
  [/^A security role with (key|name|this key or name)\b.*already exists$/i, "roleExists"],
  [/^This security role is inactive and cannot be assigned$/i, "roleInactive"],
  [/^The Super Admin role is protected and cannot be edited$/i, "superAdminRoleProtected"],
  [/^Privilege Escalation Prevention: you cannot edit your own role$/i, "cannotEditOwnRole"],
  [/^Privilege Escalation Prevention: you cannot delete your own role$/i, "cannotDeleteOwnRole"],
  [/^Only a Super Administrator can edit a system role$/i, "systemRoleSuperAdminOnly"],
  [/^System baseline roles are protected and cannot be deleted$/i, "systemRoleProtected"],
  [/^You cannot deactivate or suspend your own account$/i, "cannotDeactivateSelf"],
  [/^You cannot delete your own account$/i, "cannotDeleteSelf"],
  [/^The last active Super Administrator cannot be deactivated$/i, "lastSuperAdminDeactivate"],
  [/^The last active Super Administrator cannot be deleted$/i, "lastSuperAdminDelete"],
  [/^This email address is already in use by another user$/i, "emailInUse"],
  [/^Request payload too large/i, "payloadTooLarge"],
  [/^Malformed JSON request body$/i, "malformedRequest"],
];

function knownServerMessage(message: string): string | null {
  for (const [re, slug, params] of SERVER_MESSAGES) {
    const m = re.exec(message.trim());
    if (m) return i18n.t(`errors.server.${slug}`, params ? params(m) : undefined);
  }
  return null;
}

const asApiError = (err: unknown): ApiError | null => (isApiError(err) ? (err as ApiError) : null);

/** Codes the backend reuses for many different messages; they are only a category. */
const BUCKET_CODES = new Set([
  "VALIDATION_ERROR",
  "RESOURCE_NOT_FOUND",
  "ACCESS_UNAUTHORIZED",
  "AUTH_UNAUTHORIZED_ACCESS",
]);

const isEnglish = (): boolean => (i18n.language || "en").toLowerCase().startsWith("en");

export function localizeError(err: unknown, fallbackKey = "errors.generic"): string {
  const api = asApiError(err);
  const message =
    api?.message ?? (err instanceof Error ? err.message : typeof err === "string" ? err : "");

  if (api?.isNetworkError) return i18n.t("errors.network");

  // Axios' own "Request failed with status code 404" is not a server message.
  const serverMessage =
    message && !(api && /^Request failed with status code/i.test(message)) ? message : "";

  if (serverMessage) {
    const known = knownServerMessage(serverMessage);
    if (known) return known;
  }

  const code = api?.errorCode;
  if (code && i18n.exists(`errors.code.${code}`)) {
    const summary = i18n.t(`errors.code.${code}`);
    if (!BUCKET_CODES.has(code)) return summary;

    // Bucket code with a message we have no translation for.
    if (code === "VALIDATION_ERROR" && api && api.fieldErrors.length > 0) {
      const details = api.fieldErrors
        .map((f) => f.message)
        .filter(Boolean)
        .join(". ");
      if (details)
        return isEnglish() ? details : i18n.t("errors.validationWithDetails", { details });
    }
    if (!serverMessage) return summary;
    return isEnglish()
      ? serverMessage
      : i18n.t("errors.withDetail", { summary, detail: serverMessage });
  }

  // Unknown or missing code: the server's own words, unchanged.
  if (serverMessage) return serverMessage;

  if (api?.status && i18n.exists(`errors.status.${api.status}`)) {
    return i18n.t(`errors.status.${api.status}`);
  }
  return i18n.t(fallbackKey);
}
