package com.aiguruz.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@SpringBootApplication
@EnableMongoRepositories(considerNestedRepositories = true)
@EnableConfigurationProperties(AuthApplication.AuthProperties.class)
public class AuthApplication {

    @Bean
    JwtDecoder jwtDecoder(TokenService tokens) {
        return tokens.decoder();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @ConfigurationProperties("aiguruz.auth")
    public record AuthProperties(
            @DefaultValue("15") int accessTokenMinutes,
            @DefaultValue("14") int refreshTokenDays,
            @DefaultValue("false") boolean cookieSecure,
            @DefaultValue("") String jwtPrivateKey,
            @DefaultValue("false") boolean seedDemo) {}

    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}
