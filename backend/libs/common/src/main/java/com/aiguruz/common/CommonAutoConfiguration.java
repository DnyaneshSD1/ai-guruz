package com.aiguruz.common;

import com.aiguruz.common.ai.AiService;
import com.aiguruz.common.ai.ClaudeLlmClient;
import com.aiguruz.common.ai.LlmClient;
import com.aiguruz.common.ai.OllamaLlmClient;
import com.aiguruz.common.client.ServiceClient;
import com.aiguruz.common.events.EventPublisher;
import com.aiguruz.common.events.Events;
import com.aiguruz.common.events.HttpEventPublisher;
import com.aiguruz.common.events.SqsEventPublisher;
import com.aiguruz.common.security.CommonSecurityConfig;
import com.aiguruz.common.web.GlobalExceptionHandler;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

@AutoConfiguration
@EnableConfigurationProperties(AiGuruzProperties.class)
@Import({CommonSecurityConfig.class, GlobalExceptionHandler.class})
public class CommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    EventPublisher eventPublisher(AiGuruzProperties props) {
        return switch (props.events().mode()) {
            case "sqs" -> new SqsEventPublisher(props.events().queueUrl());
            case "none" -> event -> { };
            default -> new HttpEventPublisher(props.services().analyticsUrl(), props.security().internalKey());
        };
    }

    @Bean
    Events events(EventPublisher publisher, @Value("${spring.application.name:service}") String service) {
        return new Events(publisher, service);
    }

    @Bean
    @ConditionalOnMissingBean
    LlmClient llmClient(AiGuruzProperties props) {
        return switch (props.ai().provider()) {
            case "claude" -> new ClaudeLlmClient(props.ai());
            case "ollama" -> new OllamaLlmClient(props.ai());
            default -> LlmClient.NONE;
        };
    }

    @Bean
    AiService aiService(LlmClient client, AiGuruzProperties props) {
        return new AiService(client, props.ai());
    }

    @Bean
    ServiceClient serviceClient(AiGuruzProperties props) {
        return new ServiceClient(props.security().internalKey());
    }

    /** Refuses to start in production with the development key that guards /internal endpoints. */
    @Bean
    InitializingBean productionKeyCheck(AiGuruzProperties props, Environment env) {
        return () -> {
            if (env.matchesProfiles("prod") && props.security().internalKey().startsWith("local-")) {
                throw new IllegalStateException("INTERNAL_API_KEY must be set to a secret value in production");
            }
        };
    }
}
