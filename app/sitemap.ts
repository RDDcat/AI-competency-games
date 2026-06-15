import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";
import { SITE_URL } from "@/lib/site";

// 콘텐츠 최종 수정일(빌드 결정성을 위해 고정값 사용). 콘텐츠가 바뀌면 갱신한다.
const LAST_MODIFIED = "2026-06-15";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...GAMES.map((g) => ({
      url: `${SITE_URL}/games/${g.slug}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
