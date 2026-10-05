import { createEntitlements, definePlans } from "@sweberdev/integral";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Feature, IntegralProvider, Limit, useFeature, useLicenseCheck } from "../src/index.js";

const plans = definePlans({
  free: { features: ["basic"], limits: { projects: 2 } },
  pro: { extends: "free", features: ["export"], limits: { projects: null } },
});

function wrap(plan: string) {
  const entitlements = createEntitlements({ plans, fallbackPlan: plan });
  return ({ children }: { children: ReactNode }) => (
    <IntegralProvider entitlements={entitlements}>{children}</IntegralProvider>
  );
}

describe("react", () => {
  it("gates features", () => {
    const Wrapper = wrap("free");
    render(
      <Wrapper>
        <Feature name="export" fallback={<p>Upgrade</p>}>
          <p>Export</p>
        </Feature>
        <Feature name="basic">
          <p>Basic</p>
        </Feature>
      </Wrapper>,
    );
    expect(screen.getByText("Upgrade")).toBeTruthy();
    expect(screen.getByText("Basic")).toBeTruthy();
    expect(screen.queryByText("Export")).toBeNull();
  });

  it("checks limits with render functions", () => {
    const Wrapper = wrap("free");
    render(
      <Wrapper>
        <Limit name="projects" used={2} fallback={(c) => <p>Limit {c.limit} reached</p>}>
          <button type="button">New project</button>
        </Limit>
      </Wrapper>,
    );
    expect(screen.getByText("Limit 2 reached")).toBeTruthy();
  });

  it("exposes hooks", () => {
    const { result } = renderHook(() => useFeature("export"), { wrapper: wrap("pro") });
    expect(result.current).toBe(true);
    expect(() => renderHook(() => useFeature("x"))).toThrow(/IntegralProvider/);
  });

  it("tracks async license checks", async () => {
    let valid = false;
    const check = async () => ({ valid });
    const { result } = renderHook(() => useLicenseCheck(check, "KEY"));
    await waitFor(() => expect(result.current.status).toBe("invalid"));
    valid = true;
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe("valid"));

    const failing = renderHook(() =>
      useLicenseCheck(async () => {
        throw new Error("down");
      }, "KEY"),
    );
    await waitFor(() => expect(failing.result.current.status).toBe("error"));
    const idle = renderHook(() => useLicenseCheck(check, null));
    expect(idle.result.current.status).toBe("idle");
  });
});
