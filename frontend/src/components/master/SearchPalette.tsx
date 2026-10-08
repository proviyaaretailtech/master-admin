import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { shellApi, SEARCH_GROUPS } from "../../api/shell.api";
import type { SearchGroup, SearchHit, SearchResults } from "../../api/shell.api";
import { Modal, ErrorBox, inputCls, StatusBadge } from "./ui";

const RECENT_KEY = "master-admin.search.recent";
const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
};
const saveRecent = (q: string) => {
  try {
    const next = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* recent searches are a convenience only */
  }
};

export const hitPath = (group: SearchGroup, hit: SearchHit): string => {
  switch (group) {
    case "organizations":
      return `/organizations/${hit.id}/360`;
    case "riders":
      return `/riders?open=${encodeURIComponent(hit.id)}`;
    case "orders":
      return `/orders/${hit.id}`;
    case "users":
      return `/users`;
    case "payouts":
      return `/finance/settlements?tab=payouts`;
    default:
      return `/finance/settlements`;
  }
};

export const SearchPalette: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults({});
      setError(null);
      setActive(0);
      setRecent(loadRecent());
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setResults({});
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const h = window.setTimeout(() => {
      shellApi
        .search(term)
        .then((r) => {
          if (id !== seq.current) return;
          setResults(r ?? {});
          setError(null);
          setActive(0);
        })
        .catch((e) => id === seq.current && setError(e))
        .finally(() => id === seq.current && setLoading(false));
    }, 250);
    return () => window.clearTimeout(h);
  }, [q, open]);

  const flat = useMemo(() => {
    const out: Array<{ group: SearchGroup; hit: SearchHit }> = [];
    for (const g of SEARCH_GROUPS) for (const hit of results[g] ?? []) out.push({ group: g, hit });
    return out;
  }, [results]);

  const go = (group: SearchGroup, hit: SearchHit) => {
    if (q.trim()) saveRecent(q.trim());
    onClose();
    navigate(hitPath(group, hit));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].group, flat[active].hit);
    }
  };

  let index = -1;
  const term = q.trim();
  return (
    <Modal open={open} title={t("m.search.title")} onClose={onClose}>
      <div className="relative" onKeyDown={onKeyDown}>
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="master-search-results"
          aria-label={t("m.search.label")}
          placeholder={t("m.search.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputCls} pl-9`}
        />
      </div>
      {error ? <ErrorBox error={error} /> : null}
      <div
        id="master-search-results"
        role="listbox"
        aria-label={t("m.search.results")}
        className="space-y-3"
      >
        {term.length < 2 && recent.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">
              {t("m.search.recent")}
            </div>
            <ul className="space-y-1">
              {recent.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => setQ(r)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {term.length >= 2 && loading && (
          <div className="text-xs text-slate-500">{t("common.loading")}</div>
        )}
        {term.length >= 2 && !loading && !error && flat.length === 0 && (
          <div className="text-xs text-slate-500">{t("m.search.none")}</div>
        )}
        {SEARCH_GROUPS.map((g) => {
          const hits = results[g] ?? [];
          if (hits.length === 0) return null;
          return (
            <div key={g} role="group" aria-label={t(`m.search.group.${g}`)}>
              <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">
                {t(`m.search.group.${g}`)}
              </div>
              <ul className="space-y-0.5">
                {hits.map((hit) => {
                  index += 1;
                  const isActive = index === active;
                  return (
                    <li key={`${g}-${hit.id}`} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => go(g, hit)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                          isActive ? "bg-[#EEF9E8]" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">
                            {hit.label}
                          </span>
                          {hit.sublabel && (
                            <span className="block truncate text-slate-400">{hit.sublabel}</span>
                          )}
                        </span>
                        {hit.status && <StatusBadge code={hit.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
