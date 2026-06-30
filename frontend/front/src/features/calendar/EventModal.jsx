import React, { useState, useEffect, useRef } from "react";
import { format, addMinutes, startOfDay, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import "../../css/EventModal.css";
import { fetchEventCategories } from "../../api/eventApi";
import { useLanguage } from "../../context/languageContext";
import AdminAssignmentSelector from "../../components/AdminAssignmentSelector";
import { capitalizeCalendarLabel } from "../../utils/dateLabels";

// Genera opciones de tiempo en incrementos de 15 minutos
const generateTimeOptions = () => {
  const options = [];
  const baseDate = startOfDay(new Date());

  for (let i = 0; i < 96; i++) {
    const time = addMinutes(baseDate, i * 15);
    options.push({
      value: format(time, "HH:mm"),
      label: format(time, "HH:mm"),
    });
  }

  return options;
};

const TIME_OPTIONS = generateTimeOptions();
const EMPTY_MANAGED_USERS = Object.freeze([]);
const REMINDER_PRESETS = [5, 10, 15, 30, 60, 120, 1440];

/**
 * Convierte una fecha del backend a objeto Date de forma estable.
 * Soporta correctamente LocalDateTime sin zona horaria y fechas ISO con zona.
 *
 * @param {string|Date} value fecha recibida del backend
 * @returns {Date} fecha parseada
 */
const parseCalendarDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value !== "string") {
    return new Date(value);
  }

  const localDateTimeRegex =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/;

  const match = value.match(localDateTimeRegex);

  if (match) {
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] =
      match;

    const milliseconds = Number(fraction.slice(0, 3).padEnd(3, "0"));

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      milliseconds,
    );
  }

  return parseISO(value);
};

const normalizeReminderList = (reminders = []) => {
  const unique = [...new Set((reminders || []).map((value) => Number(value)))];
  return unique
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((a, b) => a - b);
};

const TimeSelector = ({ value, onChange, label, disabled = false, searchPlaceholder = "Search time..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const optionsRef = useRef(null);
  const selectedOptionRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && selectedOptionRef.current && optionsRef.current) {
      const selected = selectedOptionRef.current;
      const container = optionsRef.current;
      if (selected && container) {
        const top = selected.offsetTop - container.clientHeight / 2 + selected.clientHeight / 2;
        container.scrollTop = Math.max(top, 0);
      }
    }
  }, [isOpen]);

  const filteredOptions = TIME_OPTIONS.filter((opt) =>
    opt.label.includes(search),
  );

  const handleSelect = (timeValue) => {
    onChange(timeValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="time-selector" ref={dropdownRef}>
      <label className="time-selector-label">{label}</label>
      <div
        className={`time-selector-input ${isOpen ? "active" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className="time-value">{value || "00:00"}</span>
        <svg
          className="time-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      </div>

      {isOpen && (
        <div className="time-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="time-search"
            placeholder={searchPlaceholder}
            value={search}
            disabled={disabled}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="time-options" ref={optionsRef}>
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                ref={value === opt.value ? selectedOptionRef : null}
                className={`time-option ${value === opt.value ? "selected" : ""}`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EventModal = ({
  event,
  selectedDate,
  onClose,
  onSave,
  onDelete,
  isAdmin = false,
  managedUsers = EMPTY_MANAGED_USERS,
  defaultManagedUserId = null,
}) => {
  const { t, language } = useLanguage();
  const calendarLocale = language === "es" ? es : enUS;
  const [formData, setFormData] = useState({
    id: null,
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    category: "",
    isAllDay: false,
    targetUserId: "",
    targetUserIds: [],
    assignmentMode: "single",
  });
  const [reminderMinutesBeforeList, setReminderMinutesBeforeList] = useState([]);
  const [customReminderHours, setCustomReminderHours] = useState("");
  const [categories, setCategories] = useState([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (event) {
      const startDate = parseCalendarDate(event.startTime);
      const endDate = parseCalendarDate(event.endTime);
      const assignedUserIds = Array.isArray(event.assignedUserIds)
        ? event.assignedUserIds.map((userId) => String(userId))
        : event.assignedToUserId != null
          ? [String(event.assignedToUserId)]
          : [];

      const isAllManagedUsersSelected =
        managedUsers.length > 0 &&
        assignedUserIds.length === managedUsers.length &&
        managedUsers.every((user) =>
          assignedUserIds.includes(String(user.id)),
        );

      const inferredAssignmentMode = isAllManagedUsersSelected
        ? "all"
        : assignedUserIds.length > 1
          ? "multiple"
          : "single";
      const defaultSingleUserId =
        assignedUserIds[0] ??
        (defaultManagedUserId != null ? String(defaultManagedUserId) : "");

      setFormData({
        id: event.id,
        title: event.title || "",
        description: event.description || "",
        date: format(startDate, "yyyy-MM-dd"),
        startTime: format(startDate, "HH:mm"),
        endTime: format(endDate, "HH:mm"),
        location: event.location || "",
        category: event.category || "",
        isAllDay: event.isAllDay || false,
        targetUserId: defaultSingleUserId,
        targetUserIds: assignedUserIds,
        assignmentMode: inferredAssignmentMode,
      });
      setReminderMinutesBeforeList(
        Array.isArray(event.reminderMinutesBeforeList)
          ? normalizeReminderList(event.reminderMinutesBeforeList)
          : [],
      );
      setCustomReminderHours("");
      setShowMoreOptions(true);
    } else if (selectedDate) {
      const startDateTime = new Date(selectedDate);
      const roundedMinutes = Math.ceil(startDateTime.getMinutes() / 15) * 15;
      startDateTime.setMinutes(roundedMinutes, 0, 0);

      const endDateTime = addMinutes(startDateTime, 60);

      setFormData({
        id: null,
        title: "",
        description: "",
        date: format(startDateTime, "yyyy-MM-dd"),
        startTime: format(startDateTime, "HH:mm"),
        endTime: format(endDateTime, "HH:mm"),
        location: "",
        category: "",
        isAllDay: false,
        targetUserId: defaultManagedUserId ?? "",
        targetUserIds: defaultManagedUserId != null ? [String(defaultManagedUserId)] : [],
        assignmentMode: "single",
      });
      setReminderMinutesBeforeList([]);
      setCustomReminderHours("");
      setShowMoreOptions(false);
    }

    setTimeout(() => titleInputRef.current?.focus(), 100);
  }, [defaultManagedUserId, event, managedUsers, selectedDate]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await fetchEventCategories();
        setCategories(data);
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length && !formData.category) {
      setFormData((prev) => ({ ...prev, category: categories[0] }));
    }
  }, [categories, formData.category]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleTimeChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTargetSelection = (value) => {
    setFormData((prev) => {
      const current = prev.targetUserIds || [];
      const alreadySelected = current.includes(String(value));

      return {
        ...prev,
        targetUserIds: alreadySelected
          ? current.filter((item) => item !== String(value))
          : [...current, String(value)],
      };
    });
  };

  const addReminderMinutes = (value) => {
    if (isAssignedEventReadOnly) {
      return;
    }

    setReminderMinutesBeforeList((previousReminders) =>
      normalizeReminderList([...previousReminders, value]),
    );
  };

  const removeReminderMinutes = (valueToRemove) => {
    if (isAssignedEventReadOnly) {
      return;
    }

    setReminderMinutesBeforeList((previousReminders) =>
      previousReminders.filter((value) => value !== valueToRemove),
    );
  };

  const handleCustomReminderAdd = () => {
    const parsedHours = Number(customReminderHours);

    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      return;
    }

    addReminderMinutes(Math.round(parsedHours * 60));
    setCustomReminderHours("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isAssignedEventReadOnly) {
      return;
    }

    const startDateTime = `${formData.date}T${formData.startTime}`;
    const endDateTime = `${formData.date}T${formData.endTime}`;

    const eventData = {
      id: formData.id,
      title: formData.title,
      description: formData.description,
      startTime: startDateTime,
      endTime: endDateTime,
      location: formData.location,
      category: formData.category,
      isAllDay: formData.isAllDay,
      reminderMinutesBeforeList,
      targetUserId:
        isAdmin && formData.assignmentMode === "single" && formData.targetUserId
          ? Number(formData.targetUserId)
          : null,
      targetUserIds:
        isAdmin && formData.assignmentMode === "multiple"
          ? formData.targetUserIds
                            .map((value) => Number(value))
          : null,
      assignToAllUsers: isAdmin && formData.assignmentMode === "all",
    };

    onSave(eventData);
  };

  const handleDelete = () => {
    if (window.confirm(t.calendarDeleteConfirm)) {
      onDelete(formData.id);
    }
  };

  const getCategoryColor = (cat) => {
    if (!cat) return 'var(--event-work-color, #6264a7)';
    const key = String(cat).toUpperCase();
    const map = {
      REUNION: 'var(--event-reunion-color, #6264a7)',
      PERSONAL: 'var(--event-personal-color, #78b6c8)',
      PERFIL: 'var(--event-perfil-color, #f48942)',
      STUDY: 'var(--event-study-color, #66bb6a)',
      WORK: 'var(--event-work-color, #e11238)',
      FOCUS: 'var(--event-focus-color, #7c3aed)',
      HEALTH: 'var(--event-health-color, #6366f1)',
      MANDATORY: 'var(--event-mandatory-color, #ff6347)',
    };

    return map[key] || 'var(--event-work-color, #6264a7)';
  };

  /**
   * Compatibilidad defensiva:
   * - `assignedByAdmin` debería ser booleano.
   * - Si por cualquier serialización llega como string/valor raro,
   *   solo bloqueamos edición cuando sea explícitamente true o haya username admin.
   */
  const isEventAssignedByAdmin =
    event?.assignedByAdmin === true &&
    Boolean(event?.assignedByAdminUsername) &&
    event?.assignedByAdminUsername !== event?.assignedToUsername;
  const canDeleteEvent = !isEventAssignedByAdmin || isAdmin;
  const isAssignedEventReadOnly = isEventAssignedByAdmin && !isAdmin;

  const formatDisplayDate = () => {
    if (!formData.date) return "";
    const date = new Date(`${formData.date}T00:00:00`);
    return capitalizeCalendarLabel(format(date, "EEEE, d 'de' MMMM", { locale: calendarLocale }));
  };

  return (
    <div className="gcal-modal-overlay" onClick={onClose}>
      <div className="gcal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gcal-modal-header">
          <button className="gcal-close-btn" onClick={onClose} type="button">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="gcal-form">
          <div className="gcal-title-section">
            {isAdmin && (
              <AdminAssignmentSelector
                mode={formData.assignmentMode}
                onModeChange={(value) => setFormData((prev) => ({ ...prev, assignmentMode: value }))}
                singleUserId={formData.targetUserId}
                onSingleUserChange={(value) => setFormData((prev) => ({ ...prev, targetUserId: value }))}
                selectedUserIds={formData.targetUserIds || []}
                onToggleUser={toggleTargetSelection}
                managedUsers={managedUsers}
                singlePlaceholder={t.calendarSelectManagedUser}
              />
            )}

            <input
              ref={titleInputRef}
              type="text"
              name="title"
              className="gcal-title-input"
              placeholder={t.calendarAddTitle}
              value={formData.title}
              disabled={isAssignedEventReadOnly}
              onChange={handleChange}
              required
            />
          </div>

          <div className="gcal-datetime-section">
            <div className="gcal-section-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>

            <div className="gcal-datetime-content">
              <div className="gcal-date-row">
                <input
                  type="date"
                  name="date"
                  className="gcal-date-input"
                  value={formData.date}
                  disabled={isAssignedEventReadOnly}
                  onChange={handleChange}
                  required
                />
                <span className="gcal-date-display">{formatDisplayDate()}</span>
              </div>

              {!formData.isAllDay && (
                <div className="gcal-time-row">
                  <TimeSelector
                    label={t.calendarStart}
                    value={formData.startTime}
                    disabled={isAssignedEventReadOnly}
                    onChange={(val) => handleTimeChange("startTime", val)}
                    searchPlaceholder={t.calendarSearchTime}
                  />
                  <span className="gcal-time-separator">—</span>
                  <TimeSelector
                    label={t.calendarEnd}
                    value={formData.endTime}
                    disabled={isAssignedEventReadOnly}
                    onChange={(val) => handleTimeChange("endTime", val)}
                    searchPlaceholder={t.calendarSearchTime}
                  />
                </div>
              )}

              <label className="gcal-allday-toggle">
                <input
                  type="checkbox"
                  name="isAllDay"
                  checked={formData.isAllDay}
                  disabled={isAssignedEventReadOnly}
                  onChange={handleChange}
                />
                <span className="gcal-toggle-slider"></span>
                <span className="gcal-toggle-label">{t.calendarAllDay}</span>
              </label>
            </div>
          </div>

          {!showMoreOptions && (
            <button
              type="button"
              className="gcal-more-options-btn"
              onClick={() => setShowMoreOptions(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t.calendarMoreOptions}
            </button>
          )}

          {showMoreOptions && (
            <>
              <div className="gcal-location-section">
                <div className="gcal-section-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="location"
                  className="gcal-location-input"
                  placeholder={t.calendarAddLocation}
                  value={formData.location}
                  disabled={isAssignedEventReadOnly}
                  onChange={handleChange}
                />
              </div>

              <div className="gcal-description-section">
                <div className="gcal-section-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="17" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="17" y1="18" x2="3" y2="18" />
                  </svg>
                </div>
                <textarea
                  name="description"
                  className="gcal-description-input"
                  placeholder={t.calendarAddDescription}
                  value={formData.description}
                  disabled={isAssignedEventReadOnly}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="formGroup">
                <label>{t.calendarReminders}</label>
                <div className="gcal-reminder-presets">
                  {REMINDER_PRESETS.map((minutes) => {
                    const isSelected = reminderMinutesBeforeList.includes(minutes);
                    return (
                      <button
                        key={minutes}
                        type="button"
                        disabled={isAssignedEventReadOnly}
                        className={`gcal-reminder-chip ${isSelected ? "active" : ""}`}
                        onClick={() =>
                          isSelected
                            ? removeReminderMinutes(minutes)
                            : addReminderMinutes(minutes)
                        }
                      >
                        {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                      </button>
                    );
                  })}
                </div>
                <div className="gcal-reminder-custom">
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={customReminderHours}
                    disabled={isAssignedEventReadOnly}
                    onChange={(e) => setCustomReminderHours(e.target.value)}
                    placeholder={t.calendarCustomMinutes}
                  />
                  <button
                    type="button"
                    disabled={isAssignedEventReadOnly}
                    onClick={handleCustomReminderAdd}
                  >
                    {t.commonAdd}
                  </button>
                </div>
                <div className="gcal-reminder-list">
                  {reminderMinutesBeforeList.length === 0 ? (
                    <span>{t.calendarNoReminders}</span>
                  ) : (
                    reminderMinutesBeforeList.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        disabled={isAssignedEventReadOnly}
                        onClick={() => removeReminderMinutes(minutes)}
                      >
                        {minutes >= 60 ? `${minutes / 60}h` : `${minutes} min`} ✕
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="gcal-category-section">
                <div className="gcal-section-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="gcal-category-chips">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`gcal-category-chip ${formData.category === cat ? "active" : ""}`}
                      disabled={isAssignedEventReadOnly}
                      style={{
                        "--chip-color": getCategoryColor(cat),
                      }}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, category: cat }))
                      }
                    >
                      <span className="gcal-chip-dot"></span>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="gcal-modal-footer">
            {event && canDeleteEvent && (
              <button
                type="button"
                className="gcal-delete-btn"
                onClick={handleDelete}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
                </svg>
                {t.commonDelete}
              </button>
            )}
            <div className="gcal-footer-right">
              <button
                type="button"
                className="gcal-cancel-btn"
                onClick={onClose}
              >
                {t.commonCancel}
              </button>
              {!isAssignedEventReadOnly && (
                <button type="submit" className="gcal-save-btn">
                  {event ? t.commonSave : t.commonCreate}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
