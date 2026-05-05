declare global { interface Window { fbq?: (...args: any[]) => void } }

export const fbq = (...args: any[]) => {
  if (typeof window !== "undefined" && window.fbq) window.fbq(...args);
};

export const trackPageView = () => fbq("track", "PageView");
export const trackStep = (step: number) => fbq("track", "ViewContent", { content_name: `quiz_step_${step}`, step });
export const trackLead = () => fbq("track", "Lead");
export const trackSchedule = () => fbq("track", "Schedule");
