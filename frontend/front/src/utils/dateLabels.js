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
