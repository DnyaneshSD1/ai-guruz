package ai.guruz.learnmind.auth;

import ai.guruz.learnmind.auth.Model.Tenant;
import ai.guruz.learnmind.auth.Model.TenantRepository;
import ai.guruz.learnmind.auth.Model.User;
import ai.guruz.learnmind.auth.Model.UserRepository;
import ai.guruz.learnmind.common.events.Events;
import ai.guruz.learnmind.common.events.LearnEvent;
import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.common.security.Role;
import ai.guruz.learnmind.common.web.ApiException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AccountService {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public record UserView(String id, String name, String email, Role role, boolean active,
                           String tenantId, String tenantName, Instant createdAt, Instant lastLoginAt) {}

    public record TenantView(String id, String name, String joinCode, boolean personal, long members) {}

    private final UserRepository users;
    private final TenantRepository tenants;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final Events events;
    private final String timingEqualizerHash;

    public AccountService(UserRepository users, TenantRepository tenants, PasswordEncoder encoder,
                          TokenService tokens, Events events) {
        this.users = users;
        this.tenants = tenants;
        this.encoder = encoder;
        this.tokens = tokens;
        this.events = events;
        // Checked when the email is unknown, so that case costs the same time as a wrong password.
        this.timingEqualizerHash = encoder.encode("no-such-account");
    }

    /**
     * Three ways in: create an institution (caller becomes its ADMIN), join one with its code
     * (as STUDENT or RESEARCHER; higher roles are granted by an admin), or sign up alone into a personal workspace.
     */
    public User register(String name, String email, String password, String institutionName, String joinCode,
                         Role requestedRole) {
        String normalized = normalize(email);
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        Tenant tenant;
        Role role;
        if (joinCode != null && !joinCode.isBlank()) {
            tenant = tenants.findByJoinCode(joinCode.strip().toUpperCase(Locale.ROOT))
                    .orElseThrow(() -> ApiException.badRequest("That institution code is not valid"));
            role = requestedRole == Role.RESEARCHER ? Role.RESEARCHER : Role.STUDENT;
        } else {
            boolean personal = institutionName == null || institutionName.isBlank();
            tenant = createTenant(personal ? name.strip() + "'s workspace" : institutionName.strip(), personal);
            role = Role.ADMIN;
        }
        User user = createUser(tenant.id, name, normalized, password, role);
        events.emit(tenant.id, user.id, user.name, LearnEvent.AUDIT, "USER_REGISTERED", "user", user.id,
                Map.of("role", role.name()));
        return user;
    }

    public User login(String email, String password) {
        User user = users.findByEmail(normalize(email)).orElse(null);
        // Same message for unknown email and wrong password, so the endpoint does not reveal which accounts exist.
        ApiException invalid = ApiException.unauthorized("Incorrect email or password");
        if (user == null) {
            encoder.matches(password, timingEqualizerHash);
            throw invalid;
        }
        if (user.lockedUntil != null && user.lockedUntil.isAfter(Instant.now())) {
            throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "ACCOUNT_LOCKED",
                    "Too many failed attempts. Try again in a few minutes.");
        }
        if (!encoder.matches(password, user.passwordHash)) {
            user.failedAttempts++;
            if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                user.lockedUntil = Instant.now().plus(LOCK_DURATION);
                user.failedAttempts = 0;
            }
            users.save(user);
            events.emit(user.tenantId, user.id, user.name, LearnEvent.AUDIT, "LOGIN_FAILED", "user", user.id, null);
            throw invalid;
        }
        if (!user.active) {
            throw ApiException.forbidden("This account has been deactivated. Contact your administrator.");
        }
        user.failedAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = Instant.now();
        users.save(user);
        events.emit(user.tenantId, user.id, user.name, LearnEvent.AUDIT, "LOGIN_SUCCESS", "user", user.id, null);
        return user;
    }

    public User activeUser(String id) {
        return users.findById(id).filter(u -> u.active)
                .orElseThrow(() -> ApiException.unauthorized("Session is no longer valid"));
    }

    public void changePassword(CurrentUser caller, String current, String next) {
        User user = activeUser(caller.id());
        if (!encoder.matches(current, user.passwordHash)) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        user.passwordHash = encoder.encode(next);
        users.save(user);
        tokens.revokeAll(user.id);
        events.audit(caller, "PASSWORD_CHANGED", "user", user.id, null);
    }

    public List<UserView> listUsers(CurrentUser caller) {
        Tenant tenant = tenant(caller.tenantId());
        return users.findByTenantIdOrderByCreatedAtAsc(caller.tenantId()).stream().map(u -> view(u, tenant)).toList();
    }

    public UserView createByAdmin(CurrentUser caller, String name, String email, String password, Role role) {
        String normalized = normalize(email);
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User user = createUser(caller.tenantId(), name, normalized, password, role);
        events.audit(caller, "USER_CREATED", "user", user.id, Map.of("role", role.name(), "email", normalized));
        return view(user);
    }

    public UserView updateByAdmin(CurrentUser caller, String userId, Role role, Boolean active) {
        // Tenant check first: an admin can never see or touch a user of another institution.
        User user = users.findById(userId).filter(u -> u.tenantId.equals(caller.tenantId()))
                .orElseThrow(() -> ApiException.notFound("User"));
        if (user.id.equals(caller.id())) {
            throw ApiException.badRequest("You cannot change your own role or status");
        }
        if (role != null && role != user.role) {
            events.audit(caller, "ROLE_CHANGED", "user", user.id, Map.of("from", user.role.name(), "to", role.name()));
            user.role = role;
        }
        if (active != null && active != user.active) {
            events.audit(caller, active ? "USER_ACTIVATED" : "USER_DEACTIVATED", "user", user.id, null);
            user.active = active;
        }
        users.save(user);
        // Forces a new login; an already-issued access token stays valid until it expires (15 minutes by default).
        tokens.revokeAll(user.id);
        return view(user);
    }

    public TenantView tenantView(CurrentUser caller) {
        Tenant t = tenant(caller.tenantId());
        boolean canSeeCode = caller.hasAny(Role.ADMIN, Role.TEACHER);
        long members = users.findByTenantIdOrderByCreatedAtAsc(t.id).size();
        return new TenantView(t.id, t.name, canSeeCode ? t.joinCode : null, t.personal, members);
    }

    public TenantView regenerateJoinCode(CurrentUser caller) {
        Tenant t = tenant(caller.tenantId());
        t.joinCode = newJoinCode();
        tenants.save(t);
        events.audit(caller, "JOIN_CODE_REGENERATED", "tenant", t.id, null);
        return tenantView(caller);
    }

    public UserView view(User user) {
        return view(user, tenant(user.tenantId));
    }

    Tenant createTenant(String name, boolean personal) {
        Tenant tenant = new Tenant();
        tenant.name = name;
        tenant.personal = personal;
        tenant.joinCode = newJoinCode();
        return tenants.save(tenant);
    }

    User createUser(String tenantId, String name, String email, String password, Role role) {
        User user = new User();
        user.tenantId = tenantId;
        user.name = name.strip();
        user.email = email;
        user.passwordHash = encoder.encode(password);
        user.role = role;
        return users.save(user);
    }

    private Tenant tenant(String id) {
        return tenants.findById(id).orElseThrow(() -> ApiException.notFound("Institution"));
    }

    private static UserView view(User u, Tenant t) {
        return new UserView(u.id, u.name, u.email, u.role, u.active, u.tenantId, t.name, u.createdAt, u.lastLoginAt);
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static String newJoinCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return code.toString();
    }
}
