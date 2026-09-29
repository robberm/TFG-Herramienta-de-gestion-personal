import React, { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import { format } from "date-fns";
import "./CustomDatePicker.css";

const parseDateValue = (value) => {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const CustomDatePicker = ({ value, onChange, displayValue, disabled = false, min, locale = "es-ES", ariaLabel = "Select date", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleDateChange = (nextDate) => {
    onChange(format(nextDate, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  return (
    <div className={`custom-date-picker ${className}`} ref={rootRef}>
      <button type="button" className={`custom-date-trigger ${isOpen ? "active" : ""}`} disabled={disabled} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <i className="fa fa-calendar" aria-hidden="true" />
        <span>{displayValue || value}</span>
        <i className="fa fa-chevron-down custom-date-chevron" aria-hidden="true" />
      </button>
      {isOpen && !disabled && (
        <div className="custom-date-popover" role="dialog" aria-label={ariaLabel}>
          <Calendar value={parseDateValue(value)} minDate={min ? parseDateValue(min) : undefined} locale={locale} onChange={handleDateChange} next2Label={null} prev2Label={null} />
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
