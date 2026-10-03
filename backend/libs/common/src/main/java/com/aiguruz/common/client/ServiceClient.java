package com.aiguruz.common.client;

import com.aiguruz.common.security.CurrentUser;
import com.aiguruz.common.security.InternalKeyFilter;
import com.aiguruz.common.web.ApiException;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Service-to-service calls made on behalf of a user. The user's own access token is forwarded,
 * so the downstream service applies the same tenant and ownership checks as for a direct call.
 */
public class ServiceClient {

    private final RestClient client;

    /** The internal key rides along so callers may also reach /internal endpoints of other services. */
    public ServiceClient(String internalKey) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofMinutes(6));
        this.client = RestClient.builder().requestFactory(factory)
                .defaultHeader(InternalKeyFilter.HEADER, internalKey).build();
    }

    public <T> T get(String url, CurrentUser user, Class<T> type) {
        try {
            return client.get().uri(url).headers(h -> h.setBearerAuth(user.token())).retrieve().body(type);
        } catch (RestClientResponseException e) {
            throw translate(e);
        }
    }

    public <T> T post(String url, CurrentUser user, Object body, Class<T> type) {
        try {
            return client.post().uri(url).headers(h -> h.setBearerAuth(user.token()))
                    .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(type);
        } catch (RestClientResponseException e) {
            throw translate(e);
        }
    }

    private ApiException translate(RestClientResponseException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        if (status == null || status.is5xxServerError()) {
            return new ApiException(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "A dependent service failed");
        }
        return new ApiException(status, "UPSTREAM_" + status.name(), "A dependent service rejected the request");
    }
}
