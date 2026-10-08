import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { shellApi } from "../../api/shell.api";
import type { MeContext } from "../../api/shell.api";

const ORG_KEY = "master-admin.scope.org";
const LOC_KEY = "master-admin.scope.location";

const read = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const write = (k: string, v: string) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* storage unavailable: scope just is not remembered */
  }
};

export interface MasterScope {
  context: MeContext | null;
  contextError: unknown;
  loading: boolean;
  /** "" = all organizations. */
  orgId: string;
  locationId: string;
  /** Locations of the selected organization (empty when none is selected). */
  locations: MeContext["locations"];
  setOrgId: (id: string) => void;
  setLocationId: (id: string) => void;
  reload: () => void;
}

const Ctx = createContext<MasterScope>({
  context: null,
  contextError: null,
  loading: false,
  orgId: "",
  locationId: "",
  locations: [],
  setOrgId: () => {},
  setLocationId: () => {},
  reload: () => {},
});

export const MasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [context, setContext] = useState<MeContext | null>(null);
  const [contextError, setContextError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrg] = useState(() => read(ORG_KEY));
  const [locationId, setLoc] = useState(() => read(LOC_KEY));
  const [tick, setTick] = useState(0);
  const [locations, setLocations] = useState<MeContext["locations"]>([]);

  useEffect(() => {
    if (!orgId) {
      setLocations([]);
      return;
    }
    let live = true;
    shellApi
      .orgLocations(orgId)
      .then((l) => live && setLocations(l))
      .catch(() => live && setLocations([]));
    return () => {
      live = false;
    };
  }, [orgId]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    shellApi
      .getContext()
      .then((c) => {
        if (!live) return;
        setContext(c);
        setContextError(null);
      })
      .catch((e) => live && setContextError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tick]);

  const setOrgId = useCallback((id: string) => {
    setOrg(id);
    write(ORG_KEY, id);
    // A location belongs to one organization: changing org clears it.
    setLoc("");
    write(LOC_KEY, "");
  }, []);
  const setLocationId = useCallback((id: string) => {
    setLoc(id);
    write(LOC_KEY, id);
  }, []);

  const value = useMemo<MasterScope>(
    () => ({
      context,
      contextError,
      loading,
      orgId,
      locationId,
      locations,
      setOrgId,
      setLocationId,
      reload: () => setTick((n) => n + 1),
    }),
    [context, contextError, loading, orgId, locationId, locations, setOrgId, setLocationId]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useMasterScope = (): MasterScope => useContext(Ctx);
