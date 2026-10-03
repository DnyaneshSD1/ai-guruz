package com.aiguruz.auth;

import com.aiguruz.auth.AuthApplication.AuthProperties;
import com.aiguruz.auth.Model.RefreshToken;
import com.aiguruz.auth.Model.RefreshTokenRepository;
import com.aiguruz.auth.Model.SigningKey;
import com.aiguruz.auth.Model.SigningKeyRepository;
import com.aiguruz.auth.Model.User;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/**
 * Issues RS256 access tokens and opaque rotating refresh tokens.
 * The public key is published as a JWKS so the other services can verify tokens without a shared secret.
 */
@Service
public class TokenService {

    private static final String KEY_ID = "primary";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokens;
    private final AuthProperties props;
    private final RSAKey rsaKey;
    private final NimbusJwtEncoder encoder;
    private final JwtDecoder decoder;

    public TokenService(SigningKeyRepository keys, RefreshTokenRepository refreshTokens, AuthProperties props)
            throws Exception {
        this.refreshTokens = refreshTokens;
        this.props = props;
        this.rsaKey = loadKey(keys, props.jwtPrivateKey());
        this.encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsaKey)));
        this.decoder = NimbusJwtDecoder.withPublicKey(rsaKey.toRSAPublicKey()).build();
    }

    public JwtDecoder decoder() {
        return decoder;
    }

    public Map<String, Object> jwks() {
        return new JWKSet(rsaKey).toPublicJWKSet().toJSONObject();
    }

    public long accessTokenSeconds() {
        return Duration.ofMinutes(props.accessTokenMinutes()).toSeconds();
    }

    public long refreshTokenSeconds() {
        return Duration.ofDays(props.refreshTokenDays()).toSeconds();
    }

    public String accessToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("aiguruz-auth")
                .subject(user.id)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(accessTokenSeconds()))
                .claim("tid", user.tenantId)
                .claim("email", user.email)
                .claim("name", user.name)
                .claim("role", user.role.name())
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(KEY_ID).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public String newRefreshToken(String userId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken stored = new RefreshToken();
        stored.tokenHash = hash(token);
        stored.userId = userId;
        stored.expiresAt = Instant.now().plusSeconds(refreshTokenSeconds());
        refreshTokens.save(stored);
        return token;
    }

    /** Single use: the token is deleted when redeemed, and the caller issues a fresh one. */
    public Optional<String> redeemRefreshToken(String token) {
        Optional<RefreshToken> stored = refreshTokens.findByTokenHash(hash(token));
        stored.ifPresent(refreshTokens::delete);
        return stored.filter(t -> t.expiresAt.isAfter(Instant.now())).map(t -> t.userId);
    }

    public void revoke(String token) {
        refreshTokens.findByTokenHash(hash(token)).ifPresent(refreshTokens::delete);
    }

    public void revokeAll(String userId) {
        refreshTokens.deleteByUserId(userId);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static RSAKey loadKey(SigningKeyRepository keys, String configured) throws Exception {
        String encoded = configured;
        if (encoded == null || encoded.isBlank()) {
            encoded = keys.findById(KEY_ID).map(k -> k.privateKey).orElse(null);
        }
        if (encoded == null) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            SigningKey created = new SigningKey();
            created.id = KEY_ID;
            created.privateKey = Base64.getEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded());
            try {
                keys.insert(created);
            } catch (DuplicateKeyException race) {
                // another instance created the key first; use theirs
            }
            encoded = keys.findById(KEY_ID).orElseThrow().privateKey;
        }
        KeyFactory factory = KeyFactory.getInstance("RSA");
        RSAPrivateCrtKey privateKey = (RSAPrivateCrtKey) factory.generatePrivate(
                new PKCS8EncodedKeySpec(Base64.getDecoder().decode(encoded.strip())));
        RSAPublicKey publicKey = (RSAPublicKey) factory.generatePublic(
                new RSAPublicKeySpec(privateKey.getModulus(), privateKey.getPublicExponent()));
        return new RSAKey.Builder(publicKey).privateKey(privateKey).keyID(KEY_ID).build();
    }
}
