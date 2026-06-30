package net.tfg.tfgapp.DTOs.reminders;


import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ReminderDTO {

    private Long eventId;
    private String title;
    private String description;
    private String location;
    private String category;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean allDay;
    private Integer reminderMinutesBefore;
}
