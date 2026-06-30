package net.tfg.tfgapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class TfgappApplication {

	public static void main(String[] args) {
		SpringApplication.run(TfgappApplication.class, args);
	}

}
