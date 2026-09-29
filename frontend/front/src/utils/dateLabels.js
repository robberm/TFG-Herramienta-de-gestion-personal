const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];

const SPANISH_MONTH_REGEX = new RegExp(`\\b(${SPANISH_MONTHS.join("|")})\\b`, "gi");

const capitalizeWord = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export const capitalizeCalendarLabel = (value) =>
  value
    .replace(SPANISH_MONTH_REGEX, (month) => capitalizeWord(month.toLowerCase()))
    .replace(/^\p{L}/u, (firstLetter) => firstLetter.toUpperCase());

export const getShortWeekdayLabel = (date, language = "en", formatDateFn = null) => {
  if (language === "es" && typeof formatDateFn === "function") {
    const weekdayIndex = new Date(date).getDay();
    if (weekdayIndex === 3) {
      return "X";
    }

    const spanishShortDays = ["D", "L", "M", "X", "J", "V", "S"];
    return spanishShortDays[weekdayIndex] || formatDateFn(date);
  }

  return typeof formatDateFn === "function" ? formatDateFn(date) : "";
};
