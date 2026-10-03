package ai.guruz.learnmind.common;

import ai.guruz.learnmind.common.ai.AiService;
import ai.guruz.learnmind.common.ai.ClaudeLlmClient;
import ai.guruz.learnmind.common.ai.LlmClient;
import ai.guruz.learnmind.common.ai.OllamaLlmClient;
import ai.guruz.learnmind.common.client.ServiceClient;
import ai.guruz.learnmind.common.events.EventPublisher;
import ai.guruz.learnmind.common.events.Events;
import ai.guruz.learnmind.common.events.HttpEventPublisher;
import ai.guruz.learnmind.common.events.SqsEventPublisher;
import ai.guruz.learnmind.common.security.CommonSecurityConfig;
import ai.guruz.learnmind.common.web.GlobalExceptionHandler;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

@AutoConfiguration
@EnableConfigurationProperties(LearnMindProperties.class)
@Import({CommonSecurityConfig.class, GlobalExceptionHandler.class})
public class CommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    EventPublisher eventPublisher(LearnMindProperties props) {
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
    LlmClient llmClient(LearnMindProperties props) {
        return switch (props.ai().provider()) {
            case "claude" -> new ClaudeLlmClient(props.ai());
            case "ollama" -> new OllamaLlmClient(props.ai());
            default -> LlmClient.NONE;
        };
    }

    @Bean
    AiService aiService(LlmClient client, LearnMindProperties props) {
        return new AiService(client, props.ai());
    }

    @Bean
    ServiceClient serviceClient(LearnMindProperties props) {
        return new ServiceClient(props.security().internalKey());
    }

    /** Refuses to start in production with the development key that guards /internal endpoints. */
    @Bean
    InitializingBean productionKeyCheck(LearnMindProperties props, Environment env) {
        return () -> {
            if (env.matchesProfiles("prod") && props.security().internalKey().startsWith("local-")) {
                throw new IllegalStateException("INTERNAL_API_KEY must be set to a secret value in production");
            }
        };
    }
}
