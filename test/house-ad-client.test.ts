import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAdEvent } from "@/lib/house-ad";
import { GA_EVENTS, trackHouseAdView } from "@/lib/analytics";

const ev = { type: "ad.impression" as const, campaignId: 7, viewId: "abcd-1234-efgh" };
const expectedBody = { type: "ad.impression", slot: "yeokgeom-result", campaignId: 7, viewId: "abcd-1234-efgh" };

describe("sendAdEvent", () => {
  it("sendBeacon 이 있으면 application/json Blob 으로 /api/ad-event 에 보낸다", async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchFn = vi.fn();
    sendAdEvent(ev, { sendBeacon, fetch: fetchFn });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/ad-event");
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(expectedBody);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sendBeacon 이 false 를 돌려주면 fetch keepalive 로 폴백", () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    sendAdEvent(ev, { sendBeacon: () => false, fetch: fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ad-event");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual(expectedBody);
  });

  it("sendBeacon 이 없으면 fetch 로 보내고, fetch 거부·예외는 삼킨다", async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error("net")));
    expect(() => sendAdEvent(ev, { fetch: rejecting })).not.toThrow();
    expect(rejecting).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    expect(() => sendAdEvent(ev, { sendBeacon: () => { throw new Error("x"); }, fetch: throwing })).not.toThrow();
  });
});

describe("trackHouseAdView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("house_ad_view 이벤트를 slot·campaign_id 와 함께 보낸다", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    trackHouseAdView({ campaignId: 7 });
    expect(GA_EVENTS.houseAdView).toBe("house_ad_view");
    expect(gtag).toHaveBeenCalledWith("event", "house_ad_view", { slot: "yeokgeom-result", campaign_id: 7 });
  });
});
