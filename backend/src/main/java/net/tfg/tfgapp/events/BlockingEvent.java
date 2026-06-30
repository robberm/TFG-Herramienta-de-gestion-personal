package net.tfg.tfgapp.events;

// Evento para comunicar cambios de estado de bloqueo
public class BlockingEvent {
    private final boolean blocking;

    public BlockingEvent(boolean blocking) {
        this.blocking = blocking;
    }

    public boolean isBlocking() {
        return blocking;
    }
}
