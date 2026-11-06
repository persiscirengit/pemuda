import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateReadingTimeMinutes,
  sanitizeArticleContent,
} from "@/server/dal/content/articles";

describe("Article HTML Sanitization", () => {
  it("strips malicious <script> tags and inner javascript", () => {
    const dirty = '<p>Normal text</p><script>alert("xss")</script>';
    const cleaned = sanitizeArticleContent(dirty);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain('alert("xss")');
    expect(cleaned).toContain("<p>Normal text</p>");
  });

  it("strips dangerous event handlers such as onerror and onclick", () => {
    const dirty =
      '<img src="invalid.jpg" onerror="alert(1)" alt="Image" /><button onclick="evil()">Click</button>';
    const cleaned = sanitizeArticleContent(dirty);
    expect(cleaned).not.toContain("onerror");
    expect(cleaned).not.toContain("onclick");
    expect(cleaned).not.toContain("evil()");
    expect(cleaned).toContain('alt="Image"');
  });

  it("strips javascript: URI schemes from hyperlinks", () => {
    const dirty = '<a href="javascript:alert(1)">Click me</a>';
    const cleaned = sanitizeArticleContent(dirty);
    expect(cleaned).not.toContain("javascript:");
  });

  it("preserves legitimate HTML tags and text content", () => {
    const safe =
      "<h2>Heading 2</h2><p>This is <strong>bold</strong> and <em>italic</em> text.</p><ul><li>Bullet 1</li><li>Bullet 2</li></ul><blockquote>Quote</blockquote>";
    const cleaned = sanitizeArticleContent(safe);
    expect(cleaned).toBe(safe);
  });

  it("preserves .arabic classes and dir=rtl attributes for Islamic quotations", () => {
    /* cspell:disable */
    const arabicQuote =
      '<blockquote class="arabic" dir="rtl" lang="ar"><p class="arabic">إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ</p></blockquote>';
    /* cspell:enable */
    const cleaned = sanitizeArticleContent(arabicQuote);
    expect(cleaned).toContain('class="arabic"');
    expect(cleaned).toContain('dir="rtl"');
    expect(cleaned).toContain('lang="ar"');
    /* cspell:disable-next-line */
    expect(cleaned).toContain("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ");
  });

  it("preserves callout and text-center classes on container divs", () => {
    const callout =
      '<div class="callout text-center"><p>Important announcement</p></div>';
    const cleaned = sanitizeArticleContent(callout);
    expect(cleaned).toContain('class="callout text-center"');
  });
});

describe("Article Reading Time Calculation", () => {
  it("returns minimum 1 minute for empty or very short text", () => {
    expect(calculateReadingTimeMinutes("")).toBe(1);
    expect(calculateReadingTimeMinutes("<p>Hello world</p>")).toBe(1);
    expect(calculateReadingTimeMinutes("One two three four")).toBe(1);
  });

  it("correctly calculates reading time based on 200 words per minute ceiling", () => {
    // 200 words = 1 minute
    const words200 = Array(200).fill("word").join(" ");
    expect(calculateReadingTimeMinutes(words200)).toBe(1);

    // 201 words = ceil(201/200) = 2 minutes
    const words201 = Array(201).fill("word").join(" ");
    expect(calculateReadingTimeMinutes(words201)).toBe(2);

    // 450 words = ceil(450/200) = 3 minutes
    const words450 = Array(450).fill("word").join(" ");
    expect(calculateReadingTimeMinutes(words450)).toBe(3);
  });

  it("strips HTML tags before counting words", () => {
    const htmlWithFewWords =
      '<div class="callout"><p><strong>First</strong> <em>second</em> third</p></div>';
    expect(calculateReadingTimeMinutes(htmlWithFewWords)).toBe(1);
  });
});
