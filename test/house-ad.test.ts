import { describe, expect, it } from "vitest";
import { parseAdEvent, parseCampaigns, pickWeighted, withUtm, type HouseAd } from "@/lib/house-ad";

const ad = (id: number, weight: number): HouseAd => ({
  id,
  title: `t${id}`,
  body: `b${id}`,
  cta: `c${id}`,
  target_url: `https://example.com/${id}`,
  weight,
});

describe("pickWeighted", () => {
  it("빈 배열이면 null", () => {
    expect(pickWeighted([], 0.5)).toBeNull();
  });

  it("단일 광고는 항상 그 광고", () => {
    const a = ad(1, 10);
    expect(pickWeighted([a], 0)).toBe(a);
    expect(pickWeighted([a], 0.999999)).toBe(a);
  });

  it("가중치 구간 경계 (30:70)", () => {
    const a = ad(1, 30);
    const b = ad(2, 70);
    expect(pickWeighted([a, b], 0)?.id).toBe(1);
    expect(pickWeighted([a, b], 0.29)?.id).toBe(1);
    expect(pickWeighted([a, b], 0.3)?.id).toBe(2);
    expect(pickWeighted([a, b], 0.999999)?.id).toBe(2);
  });

  it("rand=1 처럼 범위 끝이어도 마지막 광고", () => {
    expect(pickWeighted([ad(1, 50), ad(2, 50)], 1)?.id).toBe(2);
  });

  it("가중치 합이 0 이하이면 null", () => {
    expect(pickWeighted([ad(1, 0), ad(2, -5)], 0.5)).toBeNull();
  });
});

describe("withUtm", () => {
  it("UTM 3종 부착", () => {
    const u = new URL(withUtm("https://example.com/book", 7));
    expect(u.searchParams.get("utm_source")).toBe("yeokgeom");
    expect(u.searchParams.get("utm_medium")).toBe("house_ad");
    expect(u.searchParams.get("utm_campaign")).toBe("c7");
  });

  it("기존 쿼리 유지", () => {
    const u = new URL(withUtm("https://example.com/book?ref=abc&x=1", 3));
    expect(u.searchParams.get("ref")).toBe("abc");
    expect(u.searchParams.get("x")).toBe("1");
    expect(u.searchParams.get("utm_campaign")).toBe("c3");
  });

  it("기존 UTM 은 덮어쓴다", () => {
    const u = new URL(
      withUtm("https://example.com/?utm_source=old&utm_medium=old&utm_campaign=old", 9),
    );
    expect(u.searchParams.getAll("utm_source")).toEqual(["yeokgeom"]);
    expect(u.searchParams.getAll("utm_medium")).toEqual(["house_ad"]);
    expect(u.searchParams.getAll("utm_campaign")).toEqual(["c9"]);
  });
});

describe("parseAdEvent", () => {
  const ok = {
    type: "ad.impression",
    slot: "yeokgeom-result",
    campaignId: 12,
    viewId: "abcd1234-ef56",
  };

  it("정상 입력 파싱", () => {
    expect(parseAdEvent(ok)).toEqual(ok);
    expect(parseAdEvent({ ...ok, type: "ad.click" })?.type).toBe("ad.click");
  });

  it("객체가 아니면 null", () => {
    expect(parseAdEvent(null)).toBeNull();
    expect(parseAdEvent("x")).toBeNull();
    expect(parseAdEvent([ok])).toBeNull();
  });

  it("허용 외 type", () => {
    expect(parseAdEvent({ ...ok, type: "ad.view" })).toBeNull();
    expect(parseAdEvent({ ...ok, type: undefined })).toBeNull();
  });

  it("허용 외 slot", () => {
    expect(parseAdEvent({ ...ok, slot: "other" })).toBeNull();
  });

  it("campaignId 비정수·비양수", () => {
    expect(parseAdEvent({ ...ok, campaignId: 1.5 })).toBeNull();
    expect(parseAdEvent({ ...ok, campaignId: "12" })).toBeNull();
    expect(parseAdEvent({ ...ok, campaignId: 0 })).toBeNull();
    expect(parseAdEvent({ ...ok, campaignId: Number.NaN })).toBeNull();
  });

  it("viewId 형식", () => {
    expect(parseAdEvent({ ...ok, viewId: "short7x" })).toBeNull();
    expect(parseAdEvent({ ...ok, viewId: "a".repeat(8) })).not.toBeNull();
    expect(parseAdEvent({ ...ok, viewId: "a".repeat(64) })).not.toBeNull();
    expect(parseAdEvent({ ...ok, viewId: "a".repeat(65) })).toBeNull();
    expect(parseAdEvent({ ...ok, viewId: "abcd_1234" })).toBeNull();
    expect(parseAdEvent({ ...ok, viewId: "abcd:1234" })).toBeNull();
    expect(parseAdEvent({ ...ok, viewId: 12345678 })).toBeNull();
  });
});

describe("parseCampaigns", () => {
  it("정상 캠페인만 남기고 여분 필드는 버린다", () => {
    const good = { ...ad(1, 50), active: true };
    const res = parseCampaigns({
      slot: "yeokgeom-result",
      campaigns: [
        good,
        { ...ad(2, 50), target_url: "http://insecure.example.com" },
        { ...ad(3, 0) },
        { ...ad(4, 10), id: "4" },
        { ...ad(5, 10), title: undefined },
        null,
      ],
    });
    expect(res).toEqual([ad(1, 50)]);
  });

  it("형식이 아니면 빈 배열", () => {
    expect(parseCampaigns(null)).toEqual([]);
    expect(parseCampaigns({})).toEqual([]);
    expect(parseCampaigns({ campaigns: "x" })).toEqual([]);
  });
});
