import { describe, expect, it } from "vitest";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

describe("getYouTubeEmbedUrl", () => {
  it("extracts ID from standard watch URL", () => {
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(getYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("extracts ID from embed URL", () => {
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("extracts ID from shorts URL", () => {
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("returns null for invalid or null inputs", () => {
    expect(getYouTubeEmbedUrl(null)).toBeNull();
    expect(getYouTubeEmbedUrl("")).toBeNull();
    expect(getYouTubeEmbedUrl("invalid-url")).toBeNull();
  });
});
