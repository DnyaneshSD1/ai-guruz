package com.aiguruz.gateway;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Fixed-window limit per client address, with a tighter budget for the credential endpoints.
 * Counters are in memory, which is right for one gateway instance; behind several instances
 * move this to the load balancer / AWS WAF or a Redis-backed limiter.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private record Window(long minute, AtomicInteger count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final int perMinute;
    private final int authPerMinute;
    private final boolean trustProxy;

    public RateLimitFilter(@Value("${aiguruz.gateway.requests-per-minute}") int perMinute,
                           @Value("${aiguruz.gateway.auth-requests-per-minute}") int authPerMinute,
                           @Value("${aiguruz.gateway.trust-proxy}") boolean trustProxy) {
        this.perMinute = perMinute;
        this.authPerMinute = authPerMinute;
        this.trustProxy = trustProxy;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (exchange.getRequest().getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }
        String path = exchange.getRequest().getPath().value();
        boolean credentials = path.equals("/api/auth/login") || path.equals("/api/auth/register");
        long minute = System.currentTimeMillis() / 60_000;
        String key = (credentials ? "auth:" : "all:") + clientAddress(exchange);

        Window window = windows.compute(key, (k, w) ->
                w == null || w.minute() != minute ? new Window(minute, new AtomicInteger()) : w);
        if (windows.size() > 50_000) {
            windows.values().removeIf(w -> w.minute() != minute);
        }
        if (window.count().incrementAndGet() > (credentials ? authPerMinute : perMinute)) {
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            exchange.getResponse().getHeaders().set("Retry-After", "60");
            return exchange.getResponse().setComplete();
        }
        return chain.filter(exchange);
    }

    private String clientAddress(ServerWebExchange exchange) {
        if (trustProxy) {
            // Behind a reverse proxy every connection comes from the proxy; the last X-Forwarded-For
            // entry is the address the proxy itself saw, which a client cannot forge.
            String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.substring(forwarded.lastIndexOf(',') + 1).strip();
            }
        }
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        return remote == null || remote.getAddress() == null ? "unknown" : remote.getAddress().getHostAddress();
    }
}
