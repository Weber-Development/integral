import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    out: {
      log: (msg: string) => lines.push(msg),
      error: (msg: string) => errors.push(msg),
    } as unknown as Console,
  };
}

describe("cli", () => {
  it("generates keys, issues and verifies a license", async () => {
    const keys = capture();
    expect(await main(["keygen"], keys.out)).toBe(0);
    const pub = keys.lines[0]?.split("=")[1] ?? "";
    const priv = keys.lines[1]?.split("=")[1] ?? "";

    const issued = capture();
    const code = await main(
      [
        "issue",
        "--product",
        "app",
        "--plan",
        "pro",
        "--private-key",
        priv,
        "--feature",
        "export",
        "--limit",
        "projects=5",
        "--limit",
        "seats=unlimited",
        "--email",
        "kunde@example.ch",
      ],
      issued.out,
    );
    expect(code).toBe(0);
    const license = issued.lines[0] ?? "";

    const ok = capture();
    expect(await main(["verify", license, "--public-key", pub, "--product", "app"], ok.out)).toBe(
      0,
    );
    expect(ok.lines[0]).toMatch(/^valid: app \/ pro/);

    const wrong = capture();
    expect(await main(["verify", license, "--public-key", pub, "--product", "x"], wrong.out)).toBe(
      1,
    );

    const inspect = capture();
    await main(["inspect", license], inspect.out);
    expect(JSON.parse(inspect.lines[0] ?? "{}")).toMatchObject({
      limits: { projects: 5, seats: null },
      customer: { email: "kunde@example.ch" },
    });
  });

  it("rejects bad limits", async () => {
    await expect(
      main(["issue", "--product", "a", "--plan", "b", "--private-key", "x", "--limit", "a=b"]),
    ).rejects.toThrow(/number or "unlimited"/);
  });
});
