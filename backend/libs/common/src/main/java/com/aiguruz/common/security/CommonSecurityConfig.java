package com.aiguruz.common.security;

import com.aiguruz.common.AiGuruzProperties;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Every service verifies the access token itself (RS256, public key fetched from auth-service JWKS),
 * so a request that bypasses the gateway is still authenticated and authorized.
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class CommonSecurityConfig {

    @Bean
    @ConditionalOnMissingBean
    JwtDecoder jwtDecoder(AiGuruzProperties props) {
        return NimbusJwtDecoder.withJwkSetUri(props.security().jwkSetUri()).build();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AiGuruzProperties props) throws Exception {
        List<String> publicPaths = props.security().publicPaths();
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            String role = jwt.getClaimAsString("role");
            return role == null
                    ? List.<GrantedAuthority>of()
                    : List.<GrantedAuthority>of(new SimpleGrantedAuthority("ROLE_" + role));
        });

        http.csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/internal/**", "/error").permitAll()
                        .requestMatchers(publicPaths.toArray(String[]::new)).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
                .addFilterBefore(new InternalKeyFilter(props.security().internalKey()),
                        BearerTokenAuthenticationFilter.class);
        return http.build();
    }
}
