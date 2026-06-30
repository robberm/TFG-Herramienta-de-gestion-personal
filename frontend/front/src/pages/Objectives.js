import React, { useCallback, useMemo, useRef, useState } from "react";
import { useError } from "../components/ErrorContext";
import "../css/Objectives.css";

import {
  createGoal,
  createHabit,
  deleteGoal,
  deleteHabit,
  getGoals,
  getHabits,
  getObjectiveLogsByRange,
  markHabitCompletion,
  updateGoal,
  updateGoalProgress,
  updateHabit,
} from "../api/objectivesApi";
import { getCurrentUserProfile } from "../api/userApi";
import { getManagedUsers } from "../api/adminApi";

import GoalModal from "../features/objectives/components/GoalModal";
import HabitModal from "../features/objectives/components/HabitModal";
import GoalsSection from "../features/objectives/components/GoalsSection";
import HabitsSection from "../features/objectives/components/HabitsSection";
import ObjectivesDashboard from "../features/objectives/components/ObjectivesDashboard";
import { useLanguage } from "../context/languageContext";
import CustomSelectDropdown from "../components/shared/CustomSelectDropdown";

import {
  buildHabitCompletionMap,
  formatIsoDate,
  getEndOfWeek,
  getStartOfWeek,
  isGoalNumeric,
} from "../features/objectives/utils/objectiveHelpers";

const Objectives = () => {
  const { t } = useLanguage();
  const { setErrorMessage } = useError();

  const [goals, setGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [habitWeekStart, setHabitWeekStart] = useState(() =>
    getStartOfWeek(new Date()),
  );
  const [selectedHabitDate, setSelectedHabitDate] = useState(() =>
    formatIsoDate(new Date()),
  );

  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedObjectives = useRef(false);
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const [isSubmittingHabit, setIsSubmittingHabit] = useState(false);
  const [isHabitUpdating, setIsHabitUpdating] = useState(false);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);

  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [profile, setProfile] = useState(null);
  const [managedUsers, setManagedUsers] = useState([]);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState(null);

  const isAdmin = profile?.role === "ADMIN";

  /**
   * Carga goals, hábitos y logs semanales.
   * El showLoader permite reutilizar esta misma función sin mostrar siempre
   * el estado de carga completo de la pantalla.
   */
  const loadSessionScope = useCallback(async () => {
    const currentProfile = await getCurrentUserProfile();
    setProfile(currentProfile);

    if (currentProfile?.role === "ADMIN") {
      const users = await getManagedUsers();
      const normalizedUsers = Array.isArray(users) ? users : [];
      setManagedUsers(normalizedUsers);
      setSelectedManagedUserId((previousId) => {
        if (
          previousId != null &&
          normalizedUsers.some((user) => user.id === previousId)
        ) {
          return previousId;
        }
        return normalizedUsers.length > 0 ? normalizedUsers[0].id : null;
      });
    } else {
      setManagedUsers([]);
      setSelectedManagedUserId(null);
    }
  }, []);

  const loadObjectivesData = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const startOfWeek = habitWeekStart;
        const endOfWeek = getEndOfWeek(startOfWeek);

        if (isAdmin) {
          const goalsResponse = await getGoals(selectedManagedUserId);
          setGoals(Array.isArray(goalsResponse) ? goalsResponse : []);
          setHabits([]);
          setLogs([]);
        } else {
          const todayWeekStart = getStartOfWeek(new Date());
          const todayWeekEnd = getEndOfWeek(todayWeekStart);
          const selectedStartIso = formatIsoDate(startOfWeek);
          const selectedEndIso = formatIsoDate(endOfWeek);
          const todayStartIso = formatIsoDate(todayWeekStart);
          const todayEndIso = formatIsoDate(todayWeekEnd);
          const shouldLoadTodayWeek = selectedStartIso !== todayStartIso;

          const [goalsResponse, habitsResponse, selectedLogsResponse, todayLogsResponse] =
            await Promise.all([
              getGoals(),
              getHabits(),
              getObjectiveLogsByRange(selectedStartIso, selectedEndIso),
              shouldLoadTodayWeek
                ? getObjectiveLogsByRange(todayStartIso, todayEndIso)
                : Promise.resolve([]),
            ]);

          const mergedLogs = [
            ...(Array.isArray(selectedLogsResponse) ? selectedLogsResponse : []),
            ...(Array.isArray(todayLogsResponse) ? todayLogsResponse : []),
          ];

          setGoals(Array.isArray(goalsResponse) ? goalsResponse : []);
          setHabits(Array.isArray(habitsResponse) ? habitsResponse : []);
          setLogs(mergedLogs);
        }
      } catch (error) {
        setErrorMessage(
          error.message || t.objectivesLoadError,
        );
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [habitWeekStart, isAdmin, selectedManagedUserId, setErrorMessage, t.objectivesLoadError],
  );

  React.useEffect(() => {
    const initialize = async () => {
      try {
        await loadSessionScope();
      } catch (error) {
        setErrorMessage(error.message || t.objectivesContextError);
      }
    };

    initialize();
  }, [loadSessionScope, setErrorMessage, t.objectivesContextError]);

  React.useEffect(() => {
    if (!profile) {
      return;
    }

    const showFullPageLoader = !hasLoadedObjectives.current;

    loadObjectivesData(showFullPageLoader).finally(() => {
      hasLoadedObjectives.current = true;
    });
  }, [loadObjectivesData, profile]);


  /**
   * Mueve la gráfica de hábitos una semana hacia atrás.
   * Es solo navegación de frontend: cambiamos fechas y reutilizamos el endpoint de logs por rango.
   */
  const handlePreviousHabitWeek = () => {
    setHabitWeekStart((currentStart) => {
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      return previousStart;
    });
  };

  /**
   * Mueve la gráfica hacia delante sin pasar de la semana actual.
   * Así evitamos pintar semanas futuras vacías que no aportan demasiado.
   */
  const handleNextHabitWeek = () => {
    setHabitWeekStart((currentStart) => {
      const currentWeekStart = getStartOfWeek(new Date());
      const nextStart = new Date(currentStart);
      nextStart.setDate(nextStart.getDate() + 7);

      return nextStart > currentWeekStart ? currentWeekStart : nextStart;
    });
  };

  const handleSelectHabitDate = (isoDate) => {
    const todayIso = formatIsoDate(new Date());
    if (isoDate > todayIso) {
      return;
    }
    setSelectedHabitDate(isoDate);
  };

  /**
   * Mapa auxiliar para consultar rápidamente si un hábito está completado
   * en una fecha concreta.
   */
  const habitCompletionMap = useMemo(
    () => buildHabitCompletionMap(logs),
    [logs],
  );

  const openCreateGoalModal = () => {
    setSelectedGoal(null);
    setIsGoalModalOpen(true);
  };

  const openEditGoalModal = (goal) => {
    setSelectedGoal(goal);
    setIsGoalModalOpen(true);
  };

  const openCreateHabitModal = () => {
    setSelectedHabit(null);
    setIsHabitModalOpen(true);
  };

  const openEditHabitModal = (habit) => {
    setSelectedHabit(habit);
    setIsHabitModalOpen(true);
  };

  const closeGoalModal = () => {
    setSelectedGoal(null);
    setIsGoalModalOpen(false);
  };

  const closeHabitModal = () => {
    setSelectedHabit(null);
    setIsHabitModalOpen(false);
  };

  /**
   * Guarda un goal nuevo o actualiza uno existente.
   * Si el goal es numérico y cambia el progreso, registramos también
   * el cambio en el histórico.
   */
  const handleGoalSubmit = async (payload) => {
    if (!payload.titulo.trim()) {
      setErrorMessage(t.objectivesGoalTitleRequired);
      return;
    }

    if (isAdmin) {
      const invalidSingle = !payload.assignToAllUsers && (!payload.targetUserIds || payload.targetUserIds.length === 0) && !payload.targetUserId;
      if (invalidSingle) {
        setErrorMessage(t.objectivesSelectUserRequired);
        return;
      }
    }

    setIsSubmittingGoal(true);

    try {
      if (selectedGoal) {
        const previousWasNumeric = isGoalNumeric(selectedGoal);
        const previousProgress = Number(selectedGoal.valorProgreso ?? 0);
        const nextProgress = payload.isNumeric
          ? Number(payload.valorProgreso ?? 0)
          : null;

        await updateGoal(selectedGoal.id, {
          titulo: payload.titulo,
          description: payload.description,
          priority: payload.priority,
          status: payload.status,
          isNumeric: payload.isNumeric,
          valorProgreso: payload.valorProgreso,
          valorObjetivo: payload.valorObjetivo,
          active: payload.active,
          targetUserId: isAdmin ? payload.targetUserId : null,
          targetUserIds: isAdmin ? payload.targetUserIds : null,
          assignToAllUsers: isAdmin ? payload.assignToAllUsers : false,
        });

        if (
          payload.isNumeric &&
          previousWasNumeric &&
          previousProgress !== nextProgress
        ) {
          await updateGoalProgress(selectedGoal.id, {
            valorProgreso: nextProgress,
          });
        }
      } else {
        await createGoal({
          titulo: payload.titulo,
          description: payload.description,
          priority: payload.priority,
          status: payload.status,
          isNumeric: payload.isNumeric,
          valorProgreso: payload.valorProgreso,
          valorObjetivo: payload.valorObjetivo,
          active: payload.active,
          targetUserId: isAdmin ? payload.targetUserId : null,
          targetUserIds: isAdmin ? payload.targetUserIds : null,
          assignToAllUsers: isAdmin ? payload.assignToAllUsers : false,
        });
      }

      closeGoalModal();
      await loadObjectivesData(false);
    } catch (error) {
      setErrorMessage(error.message || t.objectivesGoalSaveError);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  /**
   * Guarda un hábito nuevo o actualiza uno existente.
   */
  const handleHabitSubmit = async (payload) => {
    if (!payload.titulo.trim()) {
      setErrorMessage(t.objectivesHabitTitleRequired);
      return;
    }

    setIsSubmittingHabit(true);

    try {
      if (selectedHabit) {
        await updateHabit(selectedHabit.id, payload);
      } else {
        await createHabit(payload);
      }

      closeHabitModal();
      await loadObjectivesData(false);
    } catch (error) {
      setErrorMessage(error.message || t.objectivesHabitSaveError);
    } finally {
      setIsSubmittingHabit(false);
    }
  };

  /**
   * Elimina un goal tras confirmación del usuario.
   */
  const handleGoalDelete = async (goal) => {
    const confirmed = window.confirm(
      `${t.objectivesDeleteGoalConfirmPrefix} "${goal.titulo}"?`,
    );
    if (!confirmed) return;

    try {
      await deleteGoal(goal.id);
      await loadObjectivesData(false);
    } catch (error) {
      setErrorMessage(error.message || t.objectivesGoalDeleteError);
    }
  };

  /**
   * Elimina un hábito tras confirmación del usuario.
   */
  const handleHabitDelete = async (habit) => {
    const confirmed = window.confirm(
      `${t.objectivesDeleteHabitConfirmPrefix} "${habit.titulo}"?`,
    );
    if (!confirmed) return;

    try {
      await deleteHabit(habit.id);
      await loadObjectivesData(false);
    } catch (error) {
      setErrorMessage(error.message || t.objectivesHabitDeleteError);
    }
  };

  /**
   * Marca o desmarca un hábito para el día seleccionado en la gráfica.
   * Primero actualizamos la UI de forma optimista y luego sincronizamos
   * con backend. Si falla, recargamos el estado real.
   */
  const handleToggleHabitForSelectedDate = async (habit, shouldComplete) => {
    const selectedDateIso = selectedHabitDate;
    const todayIso = formatIsoDate(new Date());
    const isTodaySelected = selectedDateIso === todayIso;

    setIsHabitUpdating(true);

    setLogs((prevLogs) => {
      const filteredLogs = prevLogs.filter(
        (log) => !(log.objective?.id === habit.id && log.logDate === selectedDateIso),
      );

      return [
        ...filteredLogs,
        {
          objective: { id: habit.id },
          logDate: selectedDateIso,
          completed: shouldComplete,
        },
      ];
    });

    if (isTodaySelected) {
      setHabits((prevHabits) =>
        prevHabits.map((currentHabit) => {
          if (currentHabit.id !== habit.id) {
            return currentHabit;
          }

          const currentStreak = Number(currentHabit.currentStreak || 0);
          const bestStreak = Number(currentHabit.bestStreak || 0);

          if (shouldComplete) {
            const updatedStreak = currentStreak + 1;

            return {
              ...currentHabit,
              currentStreak: updatedStreak,
              bestStreak: Math.max(bestStreak, updatedStreak),
            };
          }

          return {
            ...currentHabit,
            currentStreak: Math.max(0, currentStreak - 1),
          };
        }),
      );
    }

    try {
      const savedLog = await markHabitCompletion(habit.id, {
        date: selectedDateIso,
        completed: shouldComplete,
      });

      if (savedLog) {
        setLogs((prevLogs) => {
          const filteredLogs = prevLogs.filter(
            (log) => !(log.objective?.id === habit.id && log.logDate === selectedDateIso),
          );
          return [...filteredLogs, savedLog];
        });
      }

      if (!isTodaySelected) {
        await loadObjectivesData(false);
      }
    } catch (error) {
      await loadObjectivesData(false);
      setErrorMessage(error.message || t.objectivesHabitUpdateError);
    } finally {
      setIsHabitUpdating(false);
    }
  };

  return (
    <div className="objectivesPage">
      <div className="pageHeader objectivesHeader">
        <div>
          <h1>{t.objectivesTitle}</h1>
          <p>
            {isAdmin
              ? t.objectivesAdminSubtitle
              : t.objectivesSubtitle}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="adminScopeSelector">
          <CustomSelectDropdown
            id="managed-user-goals"
            label={t.objectivesManagedUserLabel}
            value={String(selectedManagedUserId ?? "")}
            onChange={(value) =>
              setSelectedManagedUserId(value ? Number(value) : null)
            }
            options={
              managedUsers.length === 0
                ? [{ value: "", label: t.objectivesNoManagedUsersOption }]
                : [
                    { value: "", label: t.objectivesAllAssignedOption },
                    ...managedUsers.map((user) => ({
                      value: String(user.id),
                      label: user.username,
                    })),
                  ]
            }
            placeholder={t.objectivesManagedUserLabel}
          />
        </div>
      )}

      {isLoading ? (
        <div className="objectivesLoadingState">
          <span className="loaderDot"></span>
          <span>{t.objectivesLoading}</span>
        </div>
      ) : (
        <>
          {!isAdmin && (
            <ObjectivesDashboard
              goals={goals}
              habits={habits}
              logs={logs}
              habitWeekStart={habitWeekStart}
              selectedHabitDate={selectedHabitDate}
              onSelectHabitDate={handleSelectHabitDate}
              onPreviousHabitWeek={handlePreviousHabitWeek}
              onNextHabitWeek={handleNextHabitWeek}
            />
          )}

          <div className="objectivesContent">
            {!isAdmin && (
              <HabitsSection
                habits={habits}
                habitCompletionMap={habitCompletionMap}
                selectedHabitDate={selectedHabitDate}
                onCreate={openCreateHabitModal}
                onEdit={openEditHabitModal}
                onDelete={handleHabitDelete}
                onToggleDate={handleToggleHabitForSelectedDate}
                isHabitUpdating={isHabitUpdating}
              />
            )}

            <GoalsSection
              goals={goals}
              onCreate={openCreateGoalModal}
              onEdit={openEditGoalModal}
              onDelete={handleGoalDelete}
              isAdmin={isAdmin}
              showAssignedUserColumn={isAdmin && selectedManagedUserId == null}
            />
          </div>
        </>
      )}

      <GoalModal
        isOpen={isGoalModalOpen}
        initialData={selectedGoal}
        onClose={closeGoalModal}
        onSubmit={handleGoalSubmit}
        isSubmitting={isSubmittingGoal}
        isAdmin={isAdmin}
        managedUsers={managedUsers}
        defaultManagedUserId={selectedManagedUserId}
      />

      {!isAdmin && (
        <HabitModal
          isOpen={isHabitModalOpen}
          initialData={selectedHabit}
          onClose={closeHabitModal}
          onSubmit={handleHabitSubmit}
          isSubmitting={isSubmittingHabit}
        />
      )}
    </div>
  );
};

export default Objectives;
