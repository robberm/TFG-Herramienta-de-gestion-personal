package net.tfg.tfgapp.components;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionStore {

    /**
     * Esta clase se pueden hacer dos implementaciones:
     * public/private record -> Clase que se crea solo para transporte de datos, como un DTO, no tiene logica
     * public/private volatile -> Es un modificador de concurrencia, basicamente hacemos que pueda ser leido por varios
     * threads.
     *
     * Escojo volatile y asi cuando ya lo actualice a servidor AWS pues cambio a record y hasmap
     * @param userId
     * @param lastSeenEpochMs
     */
    private volatile Long loggedUserId = null;

    public void setLoggedUser(Long userId) {
        this.loggedUserId = userId;
    }

    public void clearLoggedUser() {
        this.loggedUserId = null;
    }

    public Long getLoggedUserId() {
        return loggedUserId;
    }
}
