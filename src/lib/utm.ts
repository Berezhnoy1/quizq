export type UTM = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

export const getUTM = (): UTM => {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const out: UTM = {};
  (["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const).forEach((k) => {
    const v = p.get(k);
    if (v) out[k] = v;
  });
  return out;
};
