const POSTHOG_HOST = "https://eu.i.posthog.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const newUrl = new URL(
      url.pathname.replace("/ph-ingest", "") + url.search,
      POSTHOG_HOST
    );
    return fetch(new Request(newUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    }));
  },
};
