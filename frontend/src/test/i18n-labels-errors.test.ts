import { describe, it, expect, vi } from "vitest";
import i18n from "../i18n";
import { loadLocale, resetLocaleCache } from "../i18n/loader";
import {
  statusLabel,
  locationTypeLabel,
  cadenceLabel,
  codeLabel,
  toCode,
  humanizeCode,
} from "../i18n/labels";
import { localizeError } from "../i18n/errors";
import { ApiError } from "../lib/api-error";

const t = i18n.t.bind(i18n);

describe("status words are codes mapped to labels", () => {
  it("normalises API words to codes", () => {
    expect(toCode("Active")).toBe("active");
    expect(toCode("Cloud Kitchen")).toBe("cloud_kitchen");
    expect(toCode("Online Ready")).toBe("online_ready");
    expect(toCode(" Roles & Permissions ")).toBe("roles_and_permissions");
    expect(humanizeCode("cloud_kitchen")).toBe("Cloud kitchen");
  });

  it("maps every lifecycle/approval status to a label in English", () => {
    const expected: Record<string, string> = {
      Draft: "Draft",
      Published: "Published",
      Retired: "Retired",
      Active: "Active",
      Inactive: "Inactive",
      Pending: "Pending",
      Suspended: "Suspended",
      Approved: "Approved",
      Rejected: "Rejected",
    };
    for (const [raw, label] of Object.entries(expected)) expect(statusLabel(t, raw)).toBe(label);
  });

  it("maps statuses, location types and cadence to Hindi glossary terms", async () => {
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    const hiT = i18n.t.bind(i18n);
    expect(statusLabel(hiT, "Draft")).toBe("ड्राफ़्ट");
    expect(statusLabel(hiT, "Published")).toBe("प्रकाशित");
    expect(statusLabel(hiT, "Retired")).toBe("बंद किया गया");
    expect(statusLabel(hiT, "Active")).toBe("सक्रिय");
    expect(statusLabel(hiT, "Inactive")).toBe("निष्क्रिय");
    expect(statusLabel(hiT, "Pending")).toBe("लंबित");
    expect(statusLabel(hiT, "Suspended")).toBe("निलंबित");
    expect(statusLabel(hiT, "Approved")).toBe("स्वीकृत");
    expect(statusLabel(hiT, "Rejected")).toBe("अस्वीकृत");
    expect(locationTypeLabel(hiT, "Cloud Kitchen")).toBe("क्लाउड किचन");
    expect(locationTypeLabel(hiT, "Restaurant")).toBe("रेस्टोरेंट");
    expect(cadenceLabel(hiT, "Monthly")).toBe("मासिक");
  });

  it("never shows a raw code: unknown values are humanised", () => {
    const label = statusLabel(t, "weird_new_status");
    expect(label).toBe("Weird new status");
    expect(label).not.toContain("_");
    expect(label).not.toContain("status.");
    expect(codeLabel(t, "roles.scope", "Some New Scope")).toBe("Some New Scope");
    expect(statusLabel(t, "")).toBe("");
    expect(statusLabel(t, null)).toBe("");
  });
});

describe("missing Hindi key falls back to English (never a blank or the key name)", () => {
  it("falls back for missing and empty Hindi values", async () => {
    resetLocaleCache("hi");
    i18n.addResourceBundle(
      "hi",
      "translation",
      { common: { save: "सहेजें", cancel: "" } },
      true,
      true
    );
    await i18n.changeLanguage("hi");
    expect(i18n.t("common.save")).toBe("सहेजें");
    expect(i18n.t("common.cancel")).toBe("Cancel"); // empty in hi
    expect(i18n.t("common.delete")).toBe("Delete"); // missing in hi
    expect(i18n.t("plans.list.title")).not.toBe("plans.list.title"); // whole namespace missing in hi
    expect(i18n.t("plans.list.title")).not.toBe("");
    resetLocaleCache("hi");
  });
});

describe("localizeError", () => {
  it("network failures get the network message", () => {
    const err = new ApiError("Cannot reach the backend server ... localhost:8000", {
      isNetworkError: true,
    });
    expect(localizeError(err)).toBe(i18n.t("errors.network"));
    expect(localizeError(err)).not.toContain("localhost");
  });

  it("maps known server messages to keys with parameters", () => {
    const login = new ApiError("Invalid email or password", {
      status: 401,
      errorCode: "AUTH_UNAUTHORIZED_ACCESS",
    });
    expect(localizeError(login)).toBe(i18n.t("errors.server.invalidCredentials"));
    const dup = new ApiError(
      "A location with code 'LOC-AB-001' already exists in this organization",
      {
        status: 400,
        errorCode: "VALIDATION_ERROR",
      }
    );
    expect(localizeError(dup)).toContain("LOC-AB-001");
  });

  it("maps specific error codes", () => {
    const err = new ApiError("Too many login attempts", {
      status: 429,
      errorCode: "AUTH_TOO_MANY_ATTEMPTS",
    });
    expect(localizeError(err)).toBe(i18n.t("errors.code.AUTH_TOO_MANY_ATTEMPTS"));
  });

  it("unknown codes fall back to the server message", () => {
    const err = new ApiError("Quota exceeded for tenant 7", {
      status: 402,
      errorCode: "BRAND_NEW_CODE",
    });
    expect(localizeError(err)).toBe("Quota exceeded for tenant 7");
    expect(localizeError(new Error("plain failure"))).toBe("plain failure");
  });

  it("uses the status table when only a status is known, else the generic text", () => {
    const axiosish = new ApiError("Request failed with status code 503", { status: 503 });
    expect(localizeError(axiosish)).toBe(i18n.t("errors.status.503"));
    expect(localizeError(undefined)).toBe(i18n.t("errors.generic"));
    expect(localizeError(new Error(""), "auth.unexpected")).toBe(i18n.t("auth.unexpected"));
  });

  it("bucket codes: English keeps the specific server text, Hindi gets summary + detail", async () => {
    const err = new ApiError(
      "Cannot delete pack 'Pro' because it has 3 active assigned organization(s). Retire it instead.",
      {
        status: 400,
        errorCode: "VALIDATION_ERROR",
      }
    );
    expect(localizeError(err)).toBe(err.message);
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    const out = localizeError(err);
    expect(out).toContain(i18n.t("errors.code.VALIDATION_ERROR"));
    expect(out).toContain("Cannot delete pack 'Pro'");
  });

  it("validation field errors: English lists them, Hindi frames them", async () => {
    const err = new ApiError("Invalid email address. Name is required", {
      status: 400,
      errorCode: "VALIDATION_ERROR",
      fieldErrors: [
        { field: "email", message: "Invalid email address" },
        { field: "name", message: "Name is required" },
      ],
    });
    expect(localizeError(err)).toBe("Invalid email address. Name is required");
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    expect(localizeError(err)).toBe(
      "कृपया इन्हें ठीक करें: Invalid email address. Name is required"
    );
  });

  it("translates the same error differently after a language switch", async () => {
    const err = new ApiError("Invalid email or password", {
      status: 401,
      errorCode: "AUTH_UNAUTHORIZED_ACCESS",
    });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const en = localizeError(err);
    await loadLocale("hi");
    await i18n.changeLanguage("hi");
    const hi = localizeError(err);
    spy.mockRestore();
    expect(hi).not.toBe(en);
    expect(hi).toContain("ग़लत");
  });
});
