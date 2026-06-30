import React, { useEffect, useRef, useState } from "react";
import "./CustomSelectDropdown.css";

const CustomSelectDropdown = ({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = "Select an option",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  return (
    <div className="custom-select-container" ref={rootRef}>
      {label && <label className="custom-select-label">{label}</label>}
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${isOpen ? "active" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="custom-select-value">{displayLabel}</span>
        <span className="custom-select-arrow">▾</span>
      </button>
      {isOpen && !disabled && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`custom-select-option ${option.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelectDropdown;
