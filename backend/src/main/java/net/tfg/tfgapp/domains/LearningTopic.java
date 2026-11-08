package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Tema sobre el que el usuario quiere que le pregunten cada día (historia, programación...).
 */
@Getter
@Setter
@Entity
@Table(name = "learning_topics",
        uniqueConstraints = @UniqueConstraint(name = "uk_learning_topics_owner_name", columnNames = {"owner_id", "name"}))
public class LearningTopic {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 60, nullable = false)
    private String name;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
}
