import React from "react";

/**
 * Marca de GMO: un anillo de día con el primer cuarto relleno en el color de acento.
 * Usa currentColor para el anillo, así que hereda el color de texto de su contenedor.
 */
const GmoMark = ({ size = 22, className = "", title }) => (
  <svg
    className={`gmoMark ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="2.5" />
    <path d="M12 5.25A6.75 6.75 0 0 1 18.75 12H12V5.25Z" fill="var(--accent)" />
  </svg>
);

export default GmoMark;
