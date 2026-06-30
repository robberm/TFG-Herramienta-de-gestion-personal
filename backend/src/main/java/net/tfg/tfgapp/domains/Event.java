package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = false)
    private String title;
    @Column(unique = false)
    private String description;
    @Column(unique = false)
    private LocalDateTime startTime;
    @Column(unique = false)
    private LocalDateTime endTime;
    @Column(unique = false)
    private String location;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventCategory category;
    @Column(unique = false)
    private Boolean isAllDay;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "EventsReminders", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "minutes_before")
    private List<Integer> reminderMinutesBeforeList = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventAssignment> assignments = new ArrayList<>();

    @Transient
    @JsonIgnore
    private EventAssignment currentAssignment;

    public Event(Long id, String title, String description, LocalDateTime startTime, LocalDateTime endTime, String location, EventCategory category, Boolean isAllDay, List<Integer> reminderMinutesBeforeList, PersonalUser user) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.endTime = endTime;
        this.location = location;
        this.category = category;
        this.isAllDay = isAllDay;
        this.reminderMinutesBeforeList = reminderMinutesBeforeList != null ? reminderMinutesBeforeList : new ArrayList<>();
        addAssignment(user, null);
    }

    public Event() {
    }

    public void addAssignment(PersonalUser target, AdminUser admin) {
        if (target == null) return;
        EventAssignment assignment = new EventAssignment();
        assignment.setEvent(this);
        assignment.setPersonalUser(target);
        assignment.setAudAdmin(admin);
        assignments.add(assignment);
        if (currentAssignment == null) currentAssignment = assignment;
    }

    public void replaceAssignments(List<PersonalUser> targets, AdminUser admin) {
        removeAssignmentsNotIn(targets);
        updateExistingAssignments(targets, admin);
        addMissingAssignments(targets, admin);
        currentAssignment = assignments.isEmpty() ? null : assignments.get(0);
    }

    private void removeAssignmentsNotIn(List<PersonalUser> targets) {
        if (targets == null || targets.isEmpty()) {
            assignments.clear();
            return;
        }

        Iterator<EventAssignment> iterator = assignments.iterator();
        while (iterator.hasNext()) {
            EventAssignment assignment = iterator.next();
            if (!containsUser(targets, assignment.getPersonalUser().getId())) {
                iterator.remove();
            }
        }
    }

    private void updateExistingAssignments(List<PersonalUser> targets, AdminUser admin) {
        if (targets == null) {
            return;
        }

        for (PersonalUser target : targets) {
            EventAssignment assignment = findAssignmentForUser(target.getId());
            if (assignment != null) {
                assignment.setAudAdmin(admin);
            }
        }
    }

    private void addMissingAssignments(List<PersonalUser> targets, AdminUser admin) {
        if (targets == null) {
            return;
        }

        for (PersonalUser target : targets) {
            if (findAssignmentForUser(target.getId()) == null) {
                addAssignment(target, admin);
            }
        }
    }

    private boolean containsUser(List<PersonalUser> targets, Long userId) {
        for (PersonalUser target : targets) {
            if (target.getId().equals(userId)) {
                return true;
            }
        }
        return false;
    }

    private EventAssignment findAssignmentForUser(Long userId) {
        for (EventAssignment assignment : assignments) {
            if (assignment.getPersonalUser().getId().equals(userId)) {
                return assignment;
            }
        }
        return null;
    }

    private EventAssignment representativeAssignment() {
        if (currentAssignment != null) return currentAssignment;
        return assignments.isEmpty() ? null : assignments.get(0);
    }

    public PersonalUser getUser() {
        EventAssignment assignment = representativeAssignment();
        return assignment != null ? assignment.getPersonalUser() : null;
    }

    public AdminUser getAudAdmin() {
        EventAssignment assignment = representativeAssignment();
        return assignment != null ? assignment.getAudAdmin() : null;
    }

    @JsonProperty("assignedByAdmin")
    public boolean isAssignedByAdmin() {
        return getAudAdmin() != null;
    }

    @JsonProperty("assignedByAdminUsername")
    public String getAssignedByAdminUsername() {
        AdminUser admin = getAudAdmin();
        return admin != null ? admin.getUsername() : null;
    }

    @JsonProperty("assignedToUsername")
    public String getAssignedToUsername() {
        PersonalUser assignedUser = getUser();
        return assignedUser != null ? assignedUser.getUsername() : null;
    }

    @JsonProperty("assignedToUserId")
    public Long getAssignedToUserId() {
        PersonalUser assignedUser = getUser();
        return assignedUser != null ? assignedUser.getId() : null;
    }

    public enum EventCategory {
        WORK("Work"), PERSONAL("Personal"), STUDY("Study"), HEALTH("Health"), MANDATORY("Mandatory"), FOCUS("Focus");

        private final String label;

        EventCategory(String label) { this.label = label; }

        public String getLabel() { return label; }
    }
}
