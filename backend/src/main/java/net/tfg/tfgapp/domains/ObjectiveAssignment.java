package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.GoalStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Asignación fuerte de un objetivo a un usuario personal.
 *
 * Objective contiene la definición común (título, descripción, tipo...). El
 * avance real de cada usuario vive aquí: estado, activo, progreso, target y
 * logs. Así un objetivo compartido mantiene trazabilidad sin mezclar progresos.
 */
@Getter
@Setter
@Entity
@Table(
        name = "objective_assignments",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"objective_id", "personal_user_id"})
        }
)
public class ObjectiveAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "objective_id", nullable = false)
    private Objective objective;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personal_user_id", nullable = false)
    private PersonalUser personalUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aud_admin_id")
    private AdminUser audAdmin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoalStatus status;

    @Column(nullable = false)
    private Boolean active;

    @Column(nullable = true)
    private Double progressValue;

    @Column(nullable = true)
    private Double targetValue;

    @Column(name = "aud_tim", nullable = false, updatable = false, columnDefinition = "datetime(6) default current_timestamp(6)")
    private LocalDateTime audTim;

    @JsonIgnore
    @OneToMany(mappedBy = "objectiveAssignment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ObjectiveLog> logs = new ArrayList<>();

    @PrePersist
    public void onCreate() {
        if (audTim == null) audTim = LocalDateTime.now();
        if (active == null) active = true;
        if (status == null) status = GoalStatus.NotStarted;
    }
}
