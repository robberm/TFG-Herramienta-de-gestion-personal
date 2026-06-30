package net.tfg.tfgapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class ReminderConfig {

    /**
     * Crea el scheduler dedicado a la planificación de reminders.
     *
     * @return scheduler configurado para tareas temporizadas
     */
    @Bean
    public TaskScheduler reminderTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("reminder-scheduler-");
        scheduler.initialize();
        return scheduler;
    }
}