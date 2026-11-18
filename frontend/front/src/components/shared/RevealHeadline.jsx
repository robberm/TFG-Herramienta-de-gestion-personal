import React, { useState } from "react";

/**
 * Titular que aparece palabra a palabra (sube y se enfoca, escalonado).
 *
 * `onceKey`: si se indica, la animación solo se reproduce la primera vez por sesión
 * (p. ej. el saludo del inicio, que se visita muchas veces al día).
 */
const RevealHeadline = ({ as: Tag = "h1", text, className = "", onceKey = null }) => {
  const [animate] = useState(() => {
    if (!onceKey) return true;
    try {
      const storageKey = `reveal:${onceKey}`;
      if (sessionStorage.getItem(storageKey)) return false;
      sessionStorage.setItem(storageKey, "1");
      return true;
    } catch {
      return true;
    }
  });

  const words = String(text || "").split(" ");

  return (
    <Tag className={`revealHeadline ${animate ? "isAnimated" : ""} ${className}`} aria-label={text}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="revealWord" style={{ "--word-index": index }} aria-hidden="true">
            {word}
          </span>
          {index < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </Tag>
  );
};

export default RevealHeadline;
