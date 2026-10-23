package net.tfg.tfgapp.domains;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Asignación de una serie de eventos a un usuario personal (equivalente a
 * {@link EventAssignment} para las series): una fila por usuario, no por ocurrencia.
 */
@Getter
@Setter
@Entity
@Table(
        name = "event_series_assignments",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"series_id", "personal_user_id"})
        }
)
public class EventSeriesAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "series_id", nullable = false)
    private EventSeries series;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personal_user_id", nullable = false)
    private PersonalUser personalUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aud_admin_id")
    private AdminUser audAdmin;

    @Column(name = "aud_tim", nullable = false, updatable = false)
    private LocalDateTime audTim;

    @PrePersist
    public void onCreate() {
        if (audTim == null) {
            audTim = LocalDateTime.now();
        }
    }
}
