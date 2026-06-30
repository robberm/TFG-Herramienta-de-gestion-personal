package net.tfg.tfgapp.events;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class BlockingEventListener {

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @EventListener
    public void handleBlockingEvent(BlockingEvent event) {
        messagingTemplate.convertAndSend("/topic/block-status",
                Map.of("blocking", event.isBlocking()));
    }
}