package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.domains.ObjectiveLog;

import java.time.LocalDate;
import java.util.List;

public interface IObjectiveLogService {

    List<ObjectiveLog> getObjectiveLogs(Integer objectiveId);

    List<ObjectiveLog> getUserLogsBetweenDates(String username, LocalDate startDate, LocalDate endDate);
}