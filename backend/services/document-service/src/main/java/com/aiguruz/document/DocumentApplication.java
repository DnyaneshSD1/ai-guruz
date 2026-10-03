package com.aiguruz.document;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication
@EnableMongoRepositories(considerNestedRepositories = true)
@EnableConfigurationProperties(DocumentApplication.DocumentProperties.class)
public class DocumentApplication {

    @ConfigurationProperties("aiguruz.documents")
    public record DocumentProperties(
            @DefaultValue("local") String storage,
            @DefaultValue("./.local/storage") String localDir,
            @DefaultValue("") String s3Bucket,
            @DefaultValue("inline") String extraction) {}

    @Bean
    Storage storage(DocumentProperties props) {
        return "s3".equals(props.storage())
                ? new Storage.S3(props.s3Bucket())
                : new Storage.Local(props.localDir());
    }

    public static void main(String[] args) {
        SpringApplication.run(DocumentApplication.class, args);
    }
}
