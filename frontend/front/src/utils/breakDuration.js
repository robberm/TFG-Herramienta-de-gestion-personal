/**
 * Duración legible de un descanso: 300 -> "5 min", 90 -> "1 min 30 s", 3600 -> "1 h".
 * La configuración se guarda en segundos, pero nadie piensa un descanso en segundos.
 *
 * @param {number} totalSeconds duración en segundos
 * @returns {string} duración formateada
 */
export const formatBreakDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  if (seconds || parts.length === 0) parts.push(`${seconds} s`);

  return parts.join(" ");
};
