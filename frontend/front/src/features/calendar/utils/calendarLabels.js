export const getCalendarTagLabel = (tagKey, t) => {
  const normalized = String(tagKey || "").trim().toUpperCase();

  const labels = {
    FOCUS: t.calendarTagFocus,
    MANDATORY: t.calendarTagMandatory,
    WORK: t.calendarTagWork,
    STUDY: t.calendarTagStudy,
    PERSONAL: t.calendarTagPersonal,
    HEALTH: t.calendarTagHealth,
  };

  return labels[normalized] || tagKey || "";
};
