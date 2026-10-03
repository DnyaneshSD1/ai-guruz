package com.aiguruz.curriculum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication
@EnableMongoRepositories(considerNestedRepositories = true)
public class CurriculumApplication {

    public static void main(String[] args) {
        SpringApplication.run(CurriculumApplication.class, args);
    }
}
