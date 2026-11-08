package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Pregunta diaria. Cada fila es una vez que se preguntó algo: los repasos programados
 * por la curva del olvido (SM-2) crean una fila nueva con reviewOf apuntando a la
 * pregunta original. Solo la última fila de cada cadena tiene nextReviewOn informado.
 */
@Getter
@Setter
@Entity
@Table(name = "daily_questions",
        uniqueConstraints = @UniqueConstraint(name = "uk_daily_questions_owner_day", columnNames = {"owner_id", "asked_on"}),
        indexes = @Index(name = "idx_daily_questions_owner_review", columnList = "owner_id, next_review_on"))
public class DailyQuestion {
    public static final double INITIAL_EASE = 2.5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "asked_on", nullable = false)
    private LocalDate askedOn;

    @Column(length = 60, nullable = false)
    private String topic;

    @Column(length = 1000, nullable = false)
    private String question;

    @Column(name = "reference_answer", length = 2000, nullable = false)
    private String referenceAnswer;

    @Column(name = "user_answer", length = 2000)
    private String userAnswer;

    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    /** Nota de 0 a 5 que pone la IA; null si no se pudo corregir (proveedor caído). */
    private Integer score;

    @Column(length = 2000)
    private String feedback;

    @Column(nullable = false)
    private int repetitions;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "ease_factor", nullable = false)
    private double easeFactor = INITIAL_EASE;

    @Column(name = "next_review_on")
    private LocalDate nextReviewOn;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_of_id")
    private DailyQuestion reviewOf;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    public boolean isAnswered() {
        return answeredAt != null;
    }

    public boolean isReview() {
        return reviewOf != null;
    }
}
