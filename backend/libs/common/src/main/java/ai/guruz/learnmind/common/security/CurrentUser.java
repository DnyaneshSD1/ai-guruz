package ai.guruz.learnmind.common.security;

import ai.guruz.learnmind.common.web.ApiException;
import java.util.Arrays;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** The authenticated caller, read from the verified access token. */
public record CurrentUser(String id, String tenantId, String email, String name, Role role, String token) {

    public static CurrentUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            return new CurrentUser(
                    jwt.getSubject(),
                    jwt.getClaimAsString("tid"),
                    jwt.getClaimAsString("email"),
                    jwt.getClaimAsString("name"),
                    Role.valueOf(jwt.getClaimAsString("role")),
                    jwt.getTokenValue());
        }
        throw ApiException.unauthorized("Authentication required");
    }

    public boolean hasAny(Role... roles) {
        return Arrays.asList(roles).contains(role);
    }

    public void require(Role... roles) {
        if (!hasAny(roles)) {
            throw ApiException.forbidden("Your role does not allow this action");
        }
    }
}
