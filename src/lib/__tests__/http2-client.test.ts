import { describe, it, expect, vi, beforeEach } from "vitest";

const agentStats = { connected: 1 };
const undiciFetchMock = vi.hoisted(() => vi.fn());

vi.mock("undici", () => ({
  Agent: vi.fn().mockImplementation(function () {
    return { stats: agentStats };
  }),
  fetch: undiciFetchMock,
}));

const describeFn = process.env.CI ? describe.skip : describe;

describeFn("http2Fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    undiciFetchMock.mockResolvedValue(new Response('{"data":"test"}', { status: 200 }));
  });

  it("should pass requests through Undici fetch with the HTTP/2 dispatcher", async () => {
    const { http2Fetch } = await import("../http2-client");

    const response = await http2Fetch("https://example.com/api");

    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ data: "test" });
    expect(undiciFetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({ dispatcher: expect.objectContaining({ stats: agentStats }) }),
    );
  });

  it("should preserve caller options", async () => {
    const { http2Fetch } = await import("../http2-client");
    const body = JSON.stringify({ name: "test" });

    await http2Fetch("https://example.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(undiciFetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        dispatcher: expect.objectContaining({ stats: agentStats }),
      }),
    );
  });

  it("should expose connection stats", async () => {
    const { getConnectionStats } = await import("../http2-client");

    expect(getConnectionStats()).toBe(agentStats);
  });
});
