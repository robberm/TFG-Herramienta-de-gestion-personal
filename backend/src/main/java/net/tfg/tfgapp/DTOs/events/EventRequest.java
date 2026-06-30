package net.tfg.tfgapp.DTOs.events;

import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.domains.Event;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class EventRequest {

    private Long id;
    private String title;
    private String description;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String location;
    private Event.EventCategory category;
    private Boolean isAllDay;
    private List<Integer> reminderMinutesBeforeList;
    private Long targetUserId;
    private List<Long> targetUserIds;
    private Boolean assignToAllUsers;
}
