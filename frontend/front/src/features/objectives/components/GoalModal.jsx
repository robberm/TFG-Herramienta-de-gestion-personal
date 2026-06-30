import React, { useEffect, useState } from "react";
import {
  EMPTY_GOAL_FORM,
  isGoalNumeric,
  normalizeGoalForm,
  toInputNumberValue,
} from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";
import AdminAssignmentSelector from "../../../components/AdminAssignmentSelector";
import CustomSelectDropdown from "../../../components/shared/CustomSelectDropdown";


const GoalModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  isAdmin = false,
  managedUsers = [],
  defaultManagedUserId = null,
}) => {
  const [form, setForm] = useState(EMPTY_GOAL_FORM);
  const { t } = useLanguage();
  const isAssignedGoalReadOnlyForUser =
    Boolean(initialData?.assignedByAdmin) && !isAdmin;
  const priorityOptions = [
    { value: "Alta", label: t.priorityHigh },
    { value: "Media", label: t.priorityMedium },
    { value: "Baja", label: t.priorityLow },
  ];
  const statusOptions = [
    { value: "NotStarted", label: t.goalStatusNotStarted },
    { value: "InProgress", label: t.goalStatusInProgress },
    { value: "Done", label: t.goalStatusDone },
  ];

  /**
   * Cuando abrimos el modal en modo edición, cargamos los datos del goal.
   * Ojo con isNumeric, porque puede venir serializado de distintas formas
   * y por eso utilizamos el helper isGoalNumeric().
   */
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      const numericGoal = isGoalNumeric(initialData);
      const assignedUserIds = Array.isArray(initialData.assignedToUserIds)
        ? initialData.assignedToUserIds
            .filter((id) => id != null)
            .map((id) => String(id))
        : [];
      const assignedUserId = initialData.assignedToUserId ?? defaultManagedUserId ?? "";
      const assignmentMode = assignedUserIds.length > 1 ? "multiple" : "single";
      const targetUserIds = assignedUserIds.length > 0
        ? assignedUserIds
        : assignedUserId !== ""
          ? [String(assignedUserId)]
          : [];

      setForm({
        titulo: initialData.titulo || "",
        description: initialData.description || "",
        priority: initialData.priority || "Media",
        status: initialData.status || "NotStarted",
        isNumeric: numericGoal,
        valorProgreso: numericGoal
          ? toInputNumberValue(initialData.valorProgreso)
          : "",
        valorObjetivo: numericGoal
          ? toInputNumberValue(initialData.valorObjetivo)
          : "",
        active: initialData.active ?? true,
        targetUserId: assignmentMode === "single" ? assignedUserId : "",
        targetUserIds,
        assignmentMode,
      });
      return;
    }

    setForm({
      ...EMPTY_GOAL_FORM,
      targetUserId: defaultManagedUserId ?? "",
      targetUserIds: defaultManagedUserId != null ? [String(defaultManagedUserId)] : [],
      assignmentMode: "single",
    });
  }, [defaultManagedUserId, initialData, isOpen]);

  if (!isOpen) return null;

  /**
   * Actualiza un campo concreto del formulario.
   */
  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Si activamos o desactivamos el modo numérico,
   * mostramos u ocultamos los campos asociados.
   */
  const handleNumericToggle = (checked) => {
    setForm((prev) => ({
      ...prev,
      isNumeric: checked,
      valorProgreso: checked ? prev.valorProgreso : "",
      valorObjetivo: checked ? prev.valorObjetivo : "",
    }));
  };

  const toggleTargetSelection = (value) => {
    setForm((prev) => {
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

  /**
   * Normaliza el formulario antes de enviarlo al componente padre.
   */
  const handleSubmit = (event) => {
    event.preventDefault();

    const selectedUserIds = (form.targetUserIds || [])
            .map((value) => Number(value));

    const isNewGoalFromAdmin = isAdmin && !initialData;
    const normalizedForm = normalizeGoalForm(form);

    if (isAssignedGoalReadOnlyForUser) {
      onSubmit({
        ...normalizedForm,
        titulo: initialData.titulo,
        description: initialData.description,
        priority: initialData.priority,
        isNumeric: isGoalNumeric(initialData),
        valorObjetivo: initialData.valorObjetivo,
        active: initialData.active,
        status: normalizedForm.status,
        valorProgreso: isGoalNumeric(initialData)
          ? normalizedForm.valorProgreso
          : null,
        targetUserId: null,
        targetUserIds: null,
        assignToAllUsers: false,
      });
      return;
    }

    onSubmit({
      ...normalizedForm,
      status: isAdmin ? (initialData?.status || "NotStarted") : normalizedForm.status,
      targetUserId:
        isAdmin && form.assignmentMode === "single" && form.targetUserId !== ""
          ? Number(form.targetUserId)
          : null,
      targetUserIds:
        isAdmin && form.assignmentMode === "multiple"
          ? selectedUserIds
          : null,
      assignToAllUsers: isAdmin && form.assignmentMode === "all",
      valorProgreso:
        isNewGoalFromAdmin && normalizedForm.isNumeric
          ? 0
          : normalizedForm.valorProgreso,
    });
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="editModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <h3>{initialData ? t.goalEditTitle : t.goalNewTitle}</h3>
          <button type="button" className="closeButton" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modalForm">
          <form className="objectiveForm" onSubmit={handleSubmit}>
            <div className="formRow">
              {isAdmin && (
                <AdminAssignmentSelector
                  mode={form.assignmentMode}
                  onModeChange={(value) => handleChange("assignmentMode", value)}
                  singleUserId={form.targetUserId}
                  onSingleUserChange={(value) => handleChange("targetUserId", value)}
                  selectedUserIds={form.targetUserIds || []}
                  onToggleUser={toggleTargetSelection}
                  managedUsers={managedUsers}
                  singlePlaceholder={t.commonSelectUser}
                />
              )}

              <div className="formGroup">
                <label htmlFor="goal-title">{t.commonTitle}</label>
                <input
                  id="goal-title"
                  type="text"
                  value={form.titulo}
                  disabled={isAssignedGoalReadOnlyForUser}
                  onChange={(event) =>
                    handleChange("titulo", event.target.value)
                  }
                  placeholder={t.goalTitlePlaceholder}
                  required
                />
              </div>

              <div className="formGroup">
                <label htmlFor="goal-priority">{t.commonPriority}</label>
                <CustomSelectDropdown
                  id="goal-priority"
                  value={form.priority}
                  disabled={isAssignedGoalReadOnlyForUser}
                  onChange={(value) => handleChange("priority", value)}
                  options={priorityOptions}
                  placeholder={t.commonPriority}
                />
              </div>
            </div>

            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="goal-description">{t.commonDescription}</label>
                <textarea
                  id="goal-description"
                  rows="3"
                  value={form.description}
                  disabled={isAssignedGoalReadOnlyForUser}
                  onChange={(event) =>
                    handleChange("description", event.target.value)
                  }
                  placeholder={t.goalDescriptionPlaceholder}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="goal-status">{t.commonStatus}</label>
                {isAdmin ? (
                  <input
                    id="goal-status"
                    type="text"
                    value={initialData?.status === "Done" ? t.goalStatusDone : initialData?.status === "InProgress" ? t.goalStatusInProgress : t.goalStatusNotStarted}
                    readOnly
                    disabled
                  />
                ) : (
                  <CustomSelectDropdown
                    id="goal-status"
                    value={form.status}
                    onChange={(value) => handleChange("status", value)}
                    options={statusOptions}
                    placeholder={t.commonStatus}
                  />
                )}

                <label className="checkboxRow" htmlFor="goal-is-numeric">
                  <input
                    id="goal-is-numeric"
                    type="checkbox"
                    checked={form.isNumeric}
                    disabled={isAssignedGoalReadOnlyForUser}
                    onChange={(event) =>
                      handleNumericToggle(event.target.checked)
                    }
                  />
                  {t.goalNumericObjective}
                </label>

              </div>
            </div>

            {form.isNumeric && (
              <>
                <div className="formRow">
                  <div className="formGroup">
                    <label htmlFor="goal-progress">{t.goalCurrentValue}</label>
                    <input
                      id="goal-progress"
                      type="number"
                      step="0.01"
                      value={form.valorProgreso}
                      onChange={(event) =>
                        handleChange("valorProgreso", event.target.value)
                      }
                      placeholder={t.goalCurrentValuePlaceholder}
                    />
                  </div>

                  <div className="formGroup">
                    <label htmlFor="goal-target">{t.goalTargetValue}</label>
                    <input
                      id="goal-target"
                      type="number"
                      step="0.01"
                      value={form.valorObjetivo}
                      disabled={isAssignedGoalReadOnlyForUser}
                      onChange={(event) =>
                        handleChange("valorObjetivo", event.target.value)
                      }
                      placeholder={t.goalTargetValuePlaceholder}
                    />
                  </div>
                </div>
              </>
            )}

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
                    : t.goalCreateButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GoalModal;
