package net.tfg.tfgapp.DTOs.objectives;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.GoalStatus;
import net.tfg.tfgapp.enumerates.ObjectivePriority;
import java.util.List;

@Getter
@Setter
public class GoalRequest {

    private String titulo;
    private String description;
    private ObjectivePriority priority;
    private GoalStatus status;

    @JsonProperty("isNumeric")
    private boolean numeric;

    private Double valorProgreso;
    private Double valorObjetivo;
    private Boolean active;
    private Long targetUserId;
    private List<Long> targetUserIds;
    private Boolean assignToAllUsers;
}
