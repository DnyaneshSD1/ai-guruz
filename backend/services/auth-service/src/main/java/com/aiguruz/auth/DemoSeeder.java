package com.aiguruz.auth;

import com.aiguruz.auth.Model.Tenant;
import com.aiguruz.auth.Model.UserRepository;
import com.aiguruz.common.security.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Local convenience only (SEED_DEMO=true): a demo institution with one account per role. Never enable in production. */
@Component
@ConditionalOnProperty(name = "aiguruz.auth.seed-demo", havingValue = "true")
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
        if (users.existsByEmail("admin@demo.aiguruz.com")) {
            return;
        }
        Tenant tenant = accounts.createTenant("Demo University", false);
        for (Role role : Role.values()) {
            String handle = role.name().toLowerCase();
            accounts.createUser(tenant.id, "Demo " + handle.substring(0, 1).toUpperCase() + handle.substring(1),
                    handle + "@demo.aiguruz.com", PASSWORD, role);
        }
        log.info("Seeded demo institution (join code {}); accounts <role>@demo.aiguruz.com / {}",
                tenant.joinCode, PASSWORD);
    }
}
