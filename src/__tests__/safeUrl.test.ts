import { describe, it, expect, afterEach } from "vitest";
import { isSafePrintUrl } from "../../server/utils/safeUrl";

describe("isSafePrintUrl (SSRF guard)", () => {
  const origAllow = process.env.PRINT_WORKER_ALLOWLIST;

  afterEach(() => {
    if (origAllow === undefined) delete process.env.PRINT_WORKER_ALLOWLIST;
    else process.env.PRINT_WORKER_ALLOWLIST = origAllow;
  });

  it("allows a normal public https worker", () => {
    delete process.env.PRINT_WORKER_ALLOWLIST;
    expect(isSafePrintUrl("https://dayin.example.workers.dev/")).toBe(true);
    expect(isSafePrintUrl("https://print.example.com/api")).toBe(true);
  });

  it("rejects non-https and malformed URLs", () => {
    expect(isSafePrintUrl("http://print.example.com")).toBe(false);
    expect(isSafePrintUrl("ftp://print.example.com")).toBe(false);
    expect(isSafePrintUrl("not a url")).toBe(false);
  });

  it("rejects loopback/localhost", () => {
    expect(isSafePrintUrl("https://localhost/")).toBe(false);
    expect(isSafePrintUrl("https://127.0.0.1/")).toBe(false);
    expect(isSafePrintUrl("https://[::1]/")).toBe(false);
    expect(isSafePrintUrl("https://app.localhost/")).toBe(false);
  });

  it("rejects private, link-local and cloud-metadata ranges", () => {
    expect(isSafePrintUrl("https://10.0.0.5/")).toBe(false);
    expect(isSafePrintUrl("https://192.168.1.1/")).toBe(false);
    expect(isSafePrintUrl("https://172.16.0.1/")).toBe(false);
    expect(isSafePrintUrl("https://172.31.255.255/")).toBe(false);
    expect(isSafePrintUrl("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isSafePrintUrl("https://100.64.0.1/")).toBe(false);
  });

  it("rejects IPv6 link-local and unique-local", () => {
    expect(isSafePrintUrl("https://[fe80::1]/")).toBe(false);
    expect(isSafePrintUrl("https://[fd00::1]/")).toBe(false);
    expect(isSafePrintUrl("https://[::ffff:127.0.0.1]/")).toBe(false);
  });

  it("enforces the allowlist when configured (but always allows workers.dev)", () => {
    process.env.PRINT_WORKER_ALLOWLIST = "print.example.com";
    expect(isSafePrintUrl("https://print.example.com/x")).toBe(true);
    expect(isSafePrintUrl("https://other.example.com/x")).toBe(false);
    expect(isSafePrintUrl("https://dayin.example.workers.dev/")).toBe(true);
  });
});
