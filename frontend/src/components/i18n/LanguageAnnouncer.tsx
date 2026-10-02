import React from "react";
import { useLanguage, useLanguageAnnouncement } from "../../i18n/useLanguage";
import { htmlLangFor } from "../../i18n";

/**
 * One persistent polite live region for the whole app. After a successful language switch it
 * announces the change in the NEW language ("भाषा हिन्दी में बदली गई"). Mounted once in App.
 */
export const LanguageAnnouncer: React.FC = () => {
  const announcement = useLanguageAnnouncement();
  const { active } = useLanguage();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      lang={htmlLangFor(active)}
      className="sr-only"
      data-testid="language-announcer"
    >
      {announcement?.text ?? ""}
    </div>
  );
};
