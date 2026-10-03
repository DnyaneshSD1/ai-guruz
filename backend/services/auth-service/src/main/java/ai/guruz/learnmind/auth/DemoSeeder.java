package ai.guruz.learnmind.auth;

import ai.guruz.learnmind.auth.Model.Tenant;
import ai.guruz.learnmind.auth.Model.UserRepository;
import ai.guruz.learnmind.common.security.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Local convenience only (SEED_DEMO=true): a demo institution with one account per role. Never enable in production. */
@Component
@ConditionalOnProperty(name = "learnmind.auth.seed-demo", havingValue = "true")
public class DemoSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoSeeder.class);
    static final String PASSWORD = "Demo@1234";

    private final AccountService accounts;
    private final UserRepository users;

    public DemoSeeder(AccountService accounts, UserRepository users) {
        this.accounts = accounts;
        this.users = users;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.existsByEmail("admin@demo.learnmind.ai")) {
            return;
        }
        Tenant tenant = accounts.createTenant("Demo University", false);
        for (Role role : Role.values()) {
            String handle = role.name().toLowerCase();
            accounts.createUser(tenant.id, "Demo " + handle.substring(0, 1).toUpperCase() + handle.substring(1),
                    handle + "@demo.learnmind.ai", PASSWORD, role);
        }
        log.info("Seeded demo institution (join code {}); accounts <role>@demo.learnmind.ai / {}",
                tenant.joinCode, PASSWORD);
    }
}
