package net.tfg.tfgapp.domains;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "habits")
@DiscriminatorValue("HABIT")
public class Habit extends Objective {

    /**
     * Racha actual del hábito.
     * Se recalcula a partir del histórico cuando se registra una nueva ejecución.
     */
    @Column(nullable = false)
    private Integer currentStreak = 0;

    /**
     * Mejor racha histórica del hábito.
     */
    @Column(nullable = false)
    private Integer bestStreak = 0;
}