package com.aiguruz.auth;

import com.aiguruz.common.security.Role;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;

/** Persistence documents and repositories of the auth service. */
public final class Model {

    private Model() {}

    @Document("users")
    public static class User {
        @Id public String id;
        @Indexed public String tenantId;
        @Indexed(unique = true) public String email;
        public String name;
        public String passwordHash;
        public Role role;
        public boolean active = true;
        public int failedAttempts;
        public Instant lockedUntil;
        public Instant createdAt = Instant.now();
        public Instant lastLoginAt;
    }

    /** An institution (or a personal workspace). Every piece of data in the platform carries its tenant id. */
    @Document("tenants")
    public static class Tenant {
        @Id public String id;
        public String name;
        @Indexed(unique = true) public String joinCode;
        public boolean personal;
        public Instant createdAt = Instant.now();
    }

    /** Only the SHA-256 of a refresh token is stored. Mongo removes expired tokens through the TTL index. */
    @Document("refresh_tokens")
    public static class RefreshToken {
        @Id public String id;
        @Indexed(unique = true) public String tokenHash;
        @Indexed public String userId;
        @Indexed(expireAfter = "0s") public Instant expiresAt;
    }

    @Document("signing_keys")
    public static class SigningKey {
        @Id public String id;
        public String privateKey;
    }

    public interface UserRepository extends MongoRepository<User, String> {
        Optional<User> findByEmail(String email);
        List<User> findByTenantIdOrderByCreatedAtAsc(String tenantId);
        boolean existsByEmail(String email);
    }

    public interface TenantRepository extends MongoRepository<Tenant, String> {
        Optional<Tenant> findByJoinCode(String joinCode);
    }

    public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {
        Optional<RefreshToken> findByTokenHash(String tokenHash);
        void deleteByUserId(String userId);
    }

    public interface SigningKeyRepository extends MongoRepository<SigningKey, String> {}
}
