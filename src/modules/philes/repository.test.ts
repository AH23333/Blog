/**
 * 文章排序功能单元测试
 *
 * 验证 compareByVolumeSort 和 comparePhiles 在不同排序配置下的正确性。
 * 覆盖 order 升序/降序、date 升序/降序、同 order 回退、同日期回退、跨 volume 排序等场景。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VolumePhileSort } from "../../config/volumes.ts";
import type { Phile } from "./model.ts";
import { compareByVolumeSort, comparePhiles } from "./sort.ts";

// ── 测试辅助函数 ────────────────────────────────────────────────────────────

function makePhile(overrides: { volume?: number; slug?: string; order?: number; date?: Date }): Phile {
  return {
    id: `volume-${overrides.volume ?? 1}/${overrides.slug ?? "test"}.md`,
    data: {
      title: overrides.slug ?? "Test",
      date: overrides.date ?? new Date("2026-01-01"),
      author: "Test",
      order: overrides.order,
      redacted: false
    },
    body: "",
    route: {
      volume: overrides.volume ?? 1,
      slug: overrides.slug ?? "test",
      href: `/volume/${overrides.volume ?? 1}/${overrides.slug ?? "test"}/`,
      volumeHref: `/volume/${overrides.volume ?? 1}/`,
      sourcePath: `volume-${overrides.volume ?? 1}/${overrides.slug ?? "test"}.md`
    },
    collection: "philes" as const,
    filePath: "",
    digest: "",
    rendered: undefined
    // biome-ignore lint/suspicious/noExplicitAny: 测试 mock 不需要完整类型
  } as any;
}

// ── compareByVolumeSort 测试 ─────────────────────────────────────────────────

describe("compareByVolumeSort", () => {
  describe("by: date", () => {
    const sort: VolumePhileSort = { by: "date", direction: "desc" };

    it("date desc: 较新的日期应排在前面", () => {
      const newer = makePhile({ slug: "newer", date: new Date("2026-06-23") });
      const older = makePhile({ slug: "older", date: new Date("2026-01-01") });
      assert.ok(compareByVolumeSort(newer, older, sort) < 0, "newer should come before older");
    });

    it("date desc: 相同日期应返回 0", () => {
      const d = new Date("2026-06-23");
      const a = makePhile({ slug: "a", date: d });
      const b = makePhile({ slug: "b", date: d });
      assert.equal(compareByVolumeSort(a, b, sort), 0);
    });

    it("date asc: 较旧的日期应排在前面", () => {
      const asc: VolumePhileSort = { by: "date", direction: "asc" };
      const older = makePhile({ slug: "older", date: new Date("2026-01-01") });
      const newer = makePhile({ slug: "newer", date: new Date("2026-06-23") });
      assert.ok(compareByVolumeSort(older, newer, asc) < 0, "older should come before newer");
    });
  });

  describe("by: order", () => {
    describe("direction: asc", () => {
      const sort: VolumePhileSort = { by: "order", direction: "asc" };

      it("不同 order 值应升序排列", () => {
        const first = makePhile({ slug: "first", order: 0 });
        const second = makePhile({ slug: "second", order: 1 });
        assert.ok(compareByVolumeSort(first, second, sort) < 0, "order 0 should come before order 1");
      });

      it("相同 order 值应回退到日期比较（使用 volume 的 direction）", () => {
        const newer = makePhile({ slug: "newer", order: 1, date: new Date("2026-06-23") });
        const older = makePhile({ slug: "older", order: 1, date: new Date("2026-01-01") });
        // direction: asc → 日期较早的在前
        assert.ok(compareByVolumeSort(older, newer, sort) < 0, "same order, older date should come first (asc)");
      });

      it("有 order 的文章应排在无 order 的文章之前", () => {
        const withOrder = makePhile({ slug: "with", order: 5 });
        const withoutOrder = makePhile({ slug: "without" });
        assert.ok(compareByVolumeSort(withOrder, withoutOrder, sort) < 0, "article with order should come first");
      });

      it("两篇都无 order 应回退到日期比较", () => {
        const newer = makePhile({ slug: "newer", date: new Date("2026-06-23") });
        const older = makePhile({ slug: "older", date: new Date("2026-01-01") });
        // direction: asc → 日期较早的在前
        assert.ok(
          compareByVolumeSort(older, newer, sort) < 0,
          "both without order, older date should come first (asc)"
        );
      });
    });

    describe("direction: desc", () => {
      const sort: VolumePhileSort = { by: "order", direction: "desc" };

      it("不同 order 值应降序排列", () => {
        const high = makePhile({ slug: "high", order: 10 });
        const low = makePhile({ slug: "low", order: 5 });
        assert.ok(compareByVolumeSort(high, low, sort) < 0, "order 10 should come before order 5 (desc)");
      });

      it("相同 order 值应回退到日期比较（使用 volume 的 direction）", () => {
        const older = makePhile({ slug: "older", order: 1, date: new Date("2026-01-01") });
        const newer = makePhile({ slug: "newer", order: 1, date: new Date("2026-06-23") });
        // direction: desc → 日期较新的在前
        assert.ok(compareByVolumeSort(newer, older, sort) < 0, "same order, newer date should come first (desc)");
      });
    });
  });
});

// ── comparePhiles 测试 ───────────────────────────────────────────────────────

describe("comparePhiles", () => {
  it("不同 volume 的文章应按 volume 编号排序", () => {
    const v0 = makePhile({ volume: 0, slug: "a" });
    const v1 = makePhile({ volume: 1, slug: "a" });
    const v2 = makePhile({ volume: 2, slug: "a" });

    assert.ok(comparePhiles(v0, v1) < 0, "volume 0 should come before volume 1");
    assert.ok(comparePhiles(v1, v2) < 0, "volume 1 should come before volume 2");
    assert.ok(comparePhiles(v0, v2) < 0, "volume 0 should come before volume 2");
  });

  it("相同 volume 内按 order 升序排列（volume 1 配置）", () => {
    const philes = [
      makePhile({ volume: 1, slug: "b", order: 1, date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "a", order: 0, date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "c", order: 1, date: new Date("2026-06-23") })
    ];

    const sorted = [...philes].sort(comparePhiles);
    const slugs = sorted.map((p) => p.route.slug);

    assert.deepEqual(slugs, ["a", "b", "c"], "should sort by order asc, then slug asc for ties");
  });

  it("相同 volume 内无 order 字段时回退到日期 + slug 排序", () => {
    const philes = [
      makePhile({ volume: 1, slug: "b", date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "a", date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "c", date: new Date("2026-01-01") })
    ];

    const sorted = [...philes].sort(comparePhiles);
    const slugs = sorted.map((p) => p.route.slug);

    // 所有无 order → 按 date asc 回退（volume 1 配置 direction: asc）
    // c(2026-01-01) < a(2026-06-23) = b(2026-06-23) → a < b by slug
    assert.deepEqual(slugs, ["c", "a", "b"], "should fall back to date asc, then slug asc");
  });

  it("排序结果应稳定（Stable Sort）", () => {
    const philes = [
      makePhile({ volume: 1, slug: "a", order: 0, date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "b", order: 0, date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "c", order: 0, date: new Date("2026-06-23") })
    ];

    const sorted1 = [...philes].sort(comparePhiles);
    const sorted2 = [...philes].sort(comparePhiles);
    const sorted3 = [...philes].reverse().sort(comparePhiles);

    const slugs1 = sorted1.map((p) => p.route.slug);
    const slugs2 = sorted2.map((p) => p.route.slug);
    const slugs3 = sorted3.map((p) => p.route.slug);

    assert.deepEqual(slugs1, slugs2, "same input should produce same output");
    assert.deepEqual(slugs1, slugs3, "reversed input should produce same output");
  });

  it("混合 order 和无 order 的文章应正确排序", () => {
    const philes = [
      makePhile({ volume: 1, slug: "no-order", date: new Date("2026-06-23") }),
      makePhile({ volume: 1, slug: "order-2", order: 2, date: new Date("2026-01-01") }),
      makePhile({ volume: 1, slug: "order-1", order: 1, date: new Date("2026-06-23") })
    ];

    const sorted = [...philes].sort(comparePhiles);
    const slugs = sorted.map((p) => p.route.slug);

    assert.deepEqual(
      slugs,
      ["order-1", "order-2", "no-order"],
      "articles with order should come first, sorted by order asc"
    );
  });
});
