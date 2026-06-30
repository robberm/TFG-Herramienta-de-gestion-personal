import React, { useEffect, useState } from "react";
import {
  EMPTY_HABIT_FORM,
  normalizeHabitForm,
} from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

const HabitModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const [form, setForm] = useState(EMPTY_HABIT_FORM);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setForm({
        titulo: initialData.titulo || "",
        description: initialData.description || "",
        active: initialData.active ?? true,
      });
      return;
    }

    setForm(EMPTY_HABIT_FORM);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(normalizeHabitForm(form));
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="editModal habitModal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <h3>{initialData ? t.habitEditTitle : t.habitNewTitle}</h3>
          <button className="closeButton" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modalForm">
          <form className="objectiveForm" onSubmit={handleSubmit}>
            <div className="formRow singleColumn">
              <div className="formGroup">
                <label htmlFor="habit-title">{t.commonTitle}</label>
                <input
                  id="habit-title"
                  type="text"
                  value={form.titulo}
                  onChange={(event) =>
                    handleChange("titulo", event.target.value)
                  }
                  placeholder={t.habitTitlePlaceholder}
                  required
                />
              </div>
            </div>

            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="habit-description">{t.commonDescription}</label>
                <textarea
                  id="habit-description"
                  rows="3"
                  value={form.description}
                  onChange={(event) =>
                    handleChange("description", event.target.value)
                  }
                  placeholder={t.habitDescriptionPlaceholder}
                />
              </div>

            </div>

            <div className="formActions">
              <button type="button" className="cancelButton" onClick={onClose}>
                {t.commonCancel}
              </button>
              <button
                type="submit"
                className="saveButton"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t.commonSaving
                  : initialData
                    ? t.commonUpdate
                    : t.habitCreateButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HabitModal;
