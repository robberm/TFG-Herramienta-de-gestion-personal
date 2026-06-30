package net.tfg.tfgapp.service.implementations;

import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.repos.ObjectiveLogRepo;
import net.tfg.tfgapp.service.interfaces.IObjectiveLogService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ObjectiveLogServiceImpl implements IObjectiveLogService {

    private final ObjectiveLogRepo objectiveLogRepo;

    public ObjectiveLogServiceImpl(ObjectiveLogRepo objectiveLogRepo) {
        this.objectiveLogRepo = objectiveLogRepo;
    }

    /**
     * Obtiene el histórico de un objetivo concreto.
     */
    @Override
    public List<ObjectiveLog> getObjectiveLogs(Integer objectiveId) {
        return objectiveLogRepo.findByObjectiveIdOrderByLogDateAsc(objectiveId);
    }

    /**
     * Obtiene el histórico de objetivos de un usuario en un rango de fechas.
     */
    @Override
    public List<ObjectiveLog> getUserLogsBetweenDates(String username, LocalDate startDate, LocalDate endDate) {
        return objectiveLogRepo.findLogsForUsernameBetweenDates(username, startDate, endDate);
    }
}