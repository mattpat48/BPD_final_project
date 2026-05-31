package com.example.billposting.infrastructure.user;

import com.example.billposting.domain.UserDetails;
import org.springframework.stereotype.Component;

@Component
public class DemoUserServiceClient implements UserServiceClient {

    @Override
    public UserDetails getUserDetails(String username) {
        String normalized = username.trim();
        String fullName = normalized.replace('.', ' ').replace('_', ' ');
        String email = normalized.toLowerCase() + "@example.com";
        String phone = "+39-" + Math.abs(normalized.hashCode() % 1_000_000_000);
        return new UserDetails(normalized, fullName, email, phone);
    }
}
