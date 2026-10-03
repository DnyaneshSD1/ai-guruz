package ai.guruz.learnmind.auth;

import ai.guruz.learnmind.auth.AccountService.TenantView;
import ai.guruz.learnmind.auth.AccountService.UserView;
import ai.guruz.learnmind.auth.AuthApplication.AuthProperties;
import ai.guruz.learnmind.auth.Model.User;
import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.common.security.Role;
import ai.guruz.learnmind.common.web.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private static final String REFRESH_COOKIE = "lm_refresh";
    private static final String PASSWORD_RULE = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$";
    private static final String PASSWORD_MESSAGE = "must be 8-72 characters with at least one letter and one digit";

    public record RegisterRequest(
            @NotBlank @Size(max = 80) String name,
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @Size(max = 120) String institutionName,
            String joinCode,
            Role role) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record RefreshRequest(String refreshToken) {}

    public record PasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String newPassword) {}

    public record CreateUserRequest(
            @NotBlank @Size(max = 80) String name,
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotNull Role role) {}

    public record UpdateUserRequest(Role role, Boolean active) {}

    /** refreshToken is only present for native clients; browsers receive it as an HttpOnly cookie instead. */
    public record Session(String accessToken, long expiresIn, String refreshToken, UserView user) {}

    private final AccountService accounts;
    private final TokenService tokens;
    private final AuthProperties props;

    public AuthController(AccountService accounts, TokenService tokens, AuthProperties props) {
        this.accounts = accounts;
        this.tokens = tokens;
        this.props = props;
    }

    @GetMapping("/.well-known/jwks.json")
    Map<String, Object> jwks() {
        return tokens.jwks();
    }

    @PostMapping("/api/auth/register")
    Session register(@Valid @RequestBody RegisterRequest req,
                     @RequestHeader(value = "X-Client", required = false) String client,
                     HttpServletResponse response) {
        User user = accounts.register(req.name(), req.email(), req.password(), req.institutionName(),
                req.joinCode(), req.role());
        return session(user, client, response);
    }

    @PostMapping("/api/auth/login")
    Session login(@Valid @RequestBody LoginRequest req,
                  @RequestHeader(value = "X-Client", required = false) String client,
                  HttpServletResponse response) {
        return session(accounts.login(req.email(), req.password()), client, response);
    }

    @PostMapping("/api/auth/refresh")
    Session refresh(@RequestBody(required = false) RefreshRequest req,
                    @CookieValue(value = REFRESH_COOKIE, required = false) String cookie,
                    @RequestHeader(value = "X-Client", required = false) String client,
                    HttpServletResponse response) {
        String presented = req != null && req.refreshToken() != null ? req.refreshToken() : cookie;
        if (presented == null || presented.isBlank()) {
            throw ApiException.unauthorized("No active session");
        }
        String userId = tokens.redeemRefreshToken(presented)
                .orElseThrow(() -> ApiException.unauthorized("Session expired. Please sign in again."));
        return session(accounts.activeUser(userId), client, response);
    }

    @PostMapping("/api/auth/logout")
    void logout(@RequestBody(required = false) RefreshRequest req,
                @CookieValue(value = REFRESH_COOKIE, required = false) String cookie,
                HttpServletResponse response) {
        String presented = req != null && req.refreshToken() != null ? req.refreshToken() : cookie;
        if (presented != null && !presented.isBlank()) {
            tokens.revoke(presented);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", 0).toString());
    }

    @GetMapping("/api/auth/me")
    UserView me() {
        return accounts.view(accounts.activeUser(CurrentUser.get().id()));
    }

    @PostMapping("/api/auth/password")
    void changePassword(@Valid @RequestBody PasswordRequest req) {
        accounts.changePassword(CurrentUser.get(), req.currentPassword(), req.newPassword());
    }

    @GetMapping("/api/tenants/me")
    TenantView tenant() {
        return accounts.tenantView(CurrentUser.get());
    }

    @PostMapping("/api/tenants/me/join-code")
    @PreAuthorize("hasRole('ADMIN')")
    TenantView regenerateJoinCode() {
        return accounts.regenerateJoinCode(CurrentUser.get());
    }

    @GetMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    List<UserView> users() {
        return accounts.listUsers(CurrentUser.get());
    }

    @PostMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    UserView createUser(@Valid @RequestBody CreateUserRequest req) {
        return accounts.createByAdmin(CurrentUser.get(), req.name(), req.email(), req.password(), req.role());
    }

    @PatchMapping("/api/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    UserView updateUser(@PathVariable String id, @RequestBody UpdateUserRequest req) {
        return accounts.updateByAdmin(CurrentUser.get(), id, req.role(), req.active());
    }

    private Session session(User user, String client, HttpServletResponse response) {
        String refresh = tokens.newRefreshToken(user.id);
        boolean nativeClient = "mobile".equalsIgnoreCase(client);
        if (!nativeClient) {
            response.addHeader(HttpHeaders.SET_COOKIE, cookie(refresh, tokens.refreshTokenSeconds()).toString());
        }
        return new Session(tokens.accessToken(user), tokens.accessTokenSeconds(),
                nativeClient ? refresh : null, accounts.view(user));
    }

    private ResponseCookie cookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
