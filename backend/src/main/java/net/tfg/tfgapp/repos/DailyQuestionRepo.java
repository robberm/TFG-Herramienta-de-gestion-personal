package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.DailyQuestion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyQuestionRepo extends JpaRepository<DailyQuestion, Long> {
    Optional<DailyQuestion> findByOwnerIdAndAskedOn(Long ownerId, LocalDate askedOn);
    Optional<DailyQuestion> findByIdAndOwnerId(Long id, Long ownerId);
    Optional<DailyQuestion> findFirstByOwnerIdAndAnsweredAtIsNullOrderByAskedOnDesc(Long ownerId);

    /** Repasos pendientes: el más atrasado primero. */
    List<DailyQuestion> findByOwnerIdAndNextReviewOnLessThanEqualOrderByNextReviewOnAsc(
            Long ownerId, LocalDate date, Pageable pageable);

    List<DailyQuestion> findByOwnerIdAndTopicOrderByAskedOnDesc(Long ownerId, String topic, Pageable pageable);
    List<DailyQuestion> findByOwnerIdOrderByAskedOnDesc(Long ownerId, Pageable pageable);
}
