import type { CachedOutcome, CheckOutcome, Entitlements, LimitCheck } from "@sweberdev/integral";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const EntitlementsContext = createContext<Entitlements | null>(null);

export interface IntegralProviderProps {
  /** Result of `createEntitlements()` from `@sweberdev/integral`. */
  entitlements: Entitlements;
  children?: ReactNode;
}

/** Makes entitlements available to `useEntitlements`, `<Feature>` and `<Limit>`. */
export function IntegralProvider({ entitlements, children }: IntegralProviderProps) {
  return (
    <EntitlementsContext.Provider value={entitlements}>{children}</EntitlementsContext.Provider>
  );
}

export function useEntitlements(): Entitlements {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error("useEntitlements must be used inside <IntegralProvider>.");
  return value;
}

/** True if the current plan or license includes the feature. */
export function useFeature(feature: string): boolean {
  return useEntitlements().has(feature);
}

/** Checks a limit against the current usage, e.g. `useLimit("projects", projects.length)`. */
export function useLimit(key: string, used: number, amount = 1): LimitCheck {
  return useEntitlements().check(key, used, amount);
}

export interface FeatureProps {
  /** Feature name, or several: all of them are required. */
  name: string | string[];
  children?: ReactNode;
  /** Rendered when the feature is missing, e.g. an upgrade prompt. */
  fallback?: ReactNode;
}

/** Renders children only if the feature is included. */
export function Feature({ name, children, fallback = null }: FeatureProps) {
  const entitlements = useEntitlements();
  const names = Array.isArray(name) ? name : [name];
  return <>{names.every((n) => entitlements.has(n)) ? children : fallback}</>;
}

export interface LimitProps {
  name: string;
  used: number;
  amount?: number;
  /** Children, or a render function that gets the limit check. */
  children?: ReactNode | ((check: LimitCheck) => ReactNode);
  /** Rendered when the limit is reached. */
  fallback?: ReactNode | ((check: LimitCheck) => ReactNode);
}

/** Renders children while `used + amount` stays within the limit. */
export function Limit({ name, used, amount = 1, children, fallback = null }: LimitProps) {
  const check = useLimit(name, used, amount);
  const node = check.allowed ? children : fallback;
  return <>{typeof node === "function" ? node(check) : node}</>;
}

export type LicenseCheckState<T> =
  | { status: "idle" | "loading"; result: null; error: null }
  | { status: "valid" | "invalid"; result: CachedOutcome<T> | CheckOutcome<T>; error: null }
  | { status: "error"; result: null; error: unknown };

/**
 * Runs an async license check (e.g. Polar validation wrapped in `withOfflineGrace`) and tracks
 * its state. The check re-runs when `key` changes (typically the license key) or on `refresh()`.
 * Pass `null` as key to skip, e.g. while no license key is entered.
 */
export function useLicenseCheck<T>(
  check: (key: string) => Promise<CheckOutcome<T>>,
  key: string | null,
): LicenseCheckState<T> & { refresh: () => void } {
  const [state, setState] = useState<LicenseCheckState<T>>({
    status: "idle",
    result: null,
    error: null,
  });
  const [round, setRound] = useState(0);
  const latest = useRef(0);
  // The latest check function, so inline functions do not re-trigger the effect.
  const checkRef = useRef(check);
  checkRef.current = check;

  // biome-ignore lint/correctness/useExhaustiveDependencies: round triggers a re-check on purpose
  useEffect(() => {
    const id = ++latest.current;
    if (key === null) {
      setState({ status: "idle", result: null, error: null });
      return;
    }
    setState({ status: "loading", result: null, error: null });
    checkRef.current(key).then(
      (result) => {
        if (id === latest.current) {
          setState({ status: result.valid ? "valid" : "invalid", result, error: null });
        }
      },
      (error: unknown) => {
        if (id === latest.current) setState({ status: "error", result: null, error });
      },
    );
  }, [key, round]);

  const refresh = useCallback(() => setRound((r) => r + 1), []);
  return { ...state, refresh };
}
