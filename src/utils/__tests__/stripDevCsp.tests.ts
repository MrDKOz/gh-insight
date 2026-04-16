import { stripDevCsp } from "../stripDevCsp";

// Minimal dev HTML that mirrors the real index.html CSP + script structure.
const devHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.github.com ws://localhost:* wss://localhost:*;" />
</head>
<body>
  <script type="application/ld+json">{"@context":"https://schema.org"}</script>
  <script type="module" crossorigin src="/assets/index-abc123.js"></script>
</body>
</html>`;

const result = stripDevCsp(devHtml);

describe("stripDevCsp — script-src", () => {
  it("removes 'unsafe-eval'", () => {
    expect(result).not.toContain("'unsafe-eval'");
  });

  it("removes 'unsafe-inline' from script-src", () => {
    const scriptSrc = result.match(/script-src[^;]*/)?.[0] ?? "";

    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("keeps 'unsafe-inline' in style-src for Emotion", () => {
    const styleSrc = result.match(/style-src[^;]*/)?.[0] ?? "";

    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("keeps 'self' in script-src", () => {
    const scriptSrc = result.match(/script-src[^;]*/)?.[0] ?? "";

    expect(scriptSrc).toContain("'self'");
  });
});

describe("stripDevCsp — connect-src", () => {
  it("removes ws://localhost dev WebSocket entry", () => {
    expect(result).not.toContain("ws://localhost");
  });

  it("removes wss://localhost dev WebSocket entry", () => {
    expect(result).not.toContain("wss://localhost");
  });

  it("keeps https://api.github.com in connect-src", () => {
    const connectSrc = result.match(/connect-src[^;]*/)?.[0] ?? "";

    expect(connectSrc).toContain("https://api.github.com");
  });

  it("removes a standalone wss:// entry even without a preceding ws:// entry", () => {
    const wssOnly = devHtml.replace("ws://localhost:* wss://localhost:*", "wss://localhost:*");
    const wssResult = stripDevCsp(wssOnly);

    expect(wssResult).not.toContain("wss://localhost");
  });
});

describe("stripDevCsp — Cloudflare Rocket Loader mitigation", () => {
  it("adds data-cfasync=\"false\" to type=\"module\" script tags", () => {
    expect(result).toContain('type="module" crossorigin src="/assets/index-abc123.js" data-cfasync="false"');
  });

  it("does not add a second data-cfasync if the attribute is already present", () => {
    const alreadyPatched = result; // result already has data-cfasync="false"
    const doubled = stripDevCsp(alreadyPatched);

    expect(doubled).not.toContain('data-cfasync="false" data-cfasync="false"');
  });

  it("does not add data-cfasync to non-module script tags", () => {
    // The ld+json script must be left untouched
    expect(result).toContain('<script type="application/ld+json">');

    const ldJson = result.match(/<script type="application\/ld\+json"[^>]*>/)?.[0] ?? "";

    expect(ldJson).not.toContain("data-cfasync");
  });
});

describe("stripDevCsp — dev pass-through", () => {
  it("returns HTML unchanged when called without transforms (identity check on unrelated content)", () => {
    // stripDevCsp is always called on production HTML; this just confirms
    // it does not corrupt unrelated content.
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain('{"@context":"https://schema.org"}');
  });
});
