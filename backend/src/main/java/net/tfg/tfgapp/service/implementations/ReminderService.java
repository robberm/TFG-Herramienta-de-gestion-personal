package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.reminders.ReminderDTO;
import net.tfg.tfgapp.service.interfaces.IReminderService;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

@Service
public class ReminderService implements IReminderService {

    private final SimpMessageSendingOperations messagingTemplate;

    public ReminderService(SimpMessageSendingOperations messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Envía un reminder al frontend mediante websocket.
     *
     * @param reminderDTO datos del reminder a mostrar
     */
    @Override
    public void sendReminder(ReminderDTO reminderDTO) {
        messagingTemplate.convertAndSend("/topic/reminders", reminderDTO);
    }
}