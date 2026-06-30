package net.tfg.tfgapp.service.interfaces;


import net.tfg.tfgapp.DTOs.reminders.ReminderDTO;

public interface IReminderService {

    /**
     * Envía un reminder al frontend mediante websocket.
     *
     * @param reminderDTO datos del reminder a mostrar
     */
    void sendReminder(ReminderDTO reminderDTO);
}