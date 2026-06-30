package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "objective_logs",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"objective_assignment_id", "log_date"})
        }
)
public class ObjectiveLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** Referencia nueva: el log pertenece al progreso individual de una asignación. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "objective_assignment_id")
    private ObjectiveAssignment objectiveAssignment;

    /** Referencia legacy temporal para migración/trazabilidad desde el modelo anterior. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "objective_id")
    private Objective objective;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(nullable = true)
    private Boolean completed;

    @Column(nullable = true)
    private Double progressValue;

    @Column(name = "aud_tim", nullable = false, updatable = false, columnDefinition = "datetime(6) default current_timestamp(6)")
    private LocalDateTime audTim;

    @JsonIgnore
    public ObjectiveAssignment getObjectiveAssignment() {
        return objectiveAssignment;
    }

    @PrePersist
    public void onCreate() {
        if (this.audTim == null) {
            this.audTim = LocalDateTime.now();
        }
    }
}
