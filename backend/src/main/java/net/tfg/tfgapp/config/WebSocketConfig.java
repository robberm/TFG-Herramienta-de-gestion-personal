package net.tfg.tfgapp.config;






import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    //Clase cuyo objetivo es comunicar directamente y bidireccionalmente entre el backend y frontend. mejor que pedir al backend mediante el frontend un checkeo continuo.
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic"); //canal al que me subscribo
        config.setApplicationDestinationPrefixes("/app"); //prefijo de envio
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws") //ruta de conexion
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
