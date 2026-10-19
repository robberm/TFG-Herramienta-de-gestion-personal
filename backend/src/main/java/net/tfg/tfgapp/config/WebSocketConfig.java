package net.tfg.tfgapp.config;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Spring dimensiona los canales STOMP según los núcleos de la CPU (núcleos x 2 hilos en
     * entrada y en salida, más un planificador por núcleo), pensando en servidores con miles
     * de clientes. Este backend corre en el PC del usuario con un único cliente (su propia
     * app), así que con unos pocos hilos sobra: en un equipo de 16 hilos eran ~80.
     */
    private static final int CHANNEL_CORE_THREADS = 2;
    private static final int CHANNEL_MAX_THREADS = 4;
    private static final int BROKER_SCHEDULER_THREADS = 1;

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

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(CHANNEL_CORE_THREADS).maxPoolSize(CHANNEL_MAX_THREADS);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(CHANNEL_CORE_THREADS).maxPoolSize(CHANNEL_MAX_THREADS);
    }

    /** Ajusta el planificador interno del broker (heartbeats de STOMP/SockJS) antes de que arranque. */
    @Bean
    static BeanPostProcessor messageBrokerSchedulerSizer() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessBeforeInitialization(Object bean, String beanName) {
                if (bean instanceof ThreadPoolTaskScheduler scheduler && "messageBrokerTaskScheduler".equals(beanName)) {
                    scheduler.setPoolSize(BROKER_SCHEDULER_THREADS);
                }
                return bean;
            }
        };
    }
}
