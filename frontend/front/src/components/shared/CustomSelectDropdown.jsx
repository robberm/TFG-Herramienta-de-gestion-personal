import React, { useEffect, useId, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label || placeholder;
  const selectOption = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleTriggerKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!isOpen) {
      const selectedIndex = options.findIndex((option) => option.value === value);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setIsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      setActiveIndex((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (options[activeIndex]) {
      selectOption(options[activeIndex]);
    }
  };

  return (
    <div className="custom-select-container" ref={rootRef}>
      {label && <label className="custom-select-label" htmlFor={id}>{label}</label>}
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${isOpen ? "active" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span className="custom-select-value">{displayLabel}</span>
        <i className="fa fa-chevron-down custom-select-arrow" aria-hidden="true" />
      </button>
      {isOpen && !disabled && (
        <div className="custom-select-dropdown" id={listboxId} role="listbox">
          {options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`custom-select-option ${option.value === value ? "selected" : ""} ${activeIndex === index ? "focused" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
              {option.value === value && <i className="fa fa-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelectDropdown;
