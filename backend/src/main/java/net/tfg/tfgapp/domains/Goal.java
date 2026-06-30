package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.GoalStatus;
import net.tfg.tfgapp.enumerates.ObjectivePriority;

@Getter
@Setter
@Entity
@Table(name = "goals")
@DiscriminatorValue("GOAL")
public class Goal extends Objective {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ObjectivePriority priority = ObjectivePriority.Media;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoalStatus status = GoalStatus.NotStarted;

    /**
     * La naturaleza numérica es propia de Goal, no de Objective ni Habit.
     * Se mantiene en GOALS.is_numeric como columna funcional.
     */
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @Column(name = "is_numeric", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean numeric = false;

    /**
     * Valores transitorios de compatibilidad para la API/frontend. El estado
     * persistente vive por usuario en ObjectiveAssignment.
     */
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @Transient
    private Double valorProgreso;

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @Transient
    private Double valorObjetivo;

    @JsonProperty("isNumeric")
    public boolean isNumeric() {
        return Boolean.TRUE.equals(numeric);
    }

    @JsonProperty("isNumeric")
    public void setNumeric(boolean numeric) {
        this.numeric = numeric;
    }

    public Double getValorProgreso() {
        ObjectiveAssignment assignment = representativeAssignment();
        return assignment != null ? assignment.getProgressValue() : valorProgreso;
    }

    public void setValorProgreso(Double valorProgreso) {
        this.valorProgreso = valorProgreso;
        ObjectiveAssignment assignment = representativeAssignment();
        if (assignment != null) {
            assignment.setProgressValue(valorProgreso);
        }
    }

    public Double getValorObjetivo() {
        ObjectiveAssignment assignment = representativeAssignment();
        return assignment != null ? assignment.getTargetValue() : valorObjetivo;
    }

    public void setValorObjetivo(Double valorObjetivo) {
        this.valorObjetivo = valorObjetivo;
        ObjectiveAssignment assignment = representativeAssignment();
        if (assignment != null) {
            assignment.setTargetValue(valorObjetivo);
        }
    }

    @PrePersist
    @PreUpdate
    private void normalizeGoalNumericColumn() {
        if (numeric == null) {
            numeric = false;
        }
    }
}
