package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Asignación individual de un evento a un usuario personal.
 *
 * Esta tabla conecta cada evento con su usuario personal. Para eventos propios
 * el admin audit será null; para eventos asignados queda trazado el admin y el
 * instante audit de creación sin duplicar la definición del evento.
 */
@Getter
@Setter
@Entity
@Table(
        name = "event_assignments",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"event_id", "personal_user_id"})
        }
)
public class EventAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

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
