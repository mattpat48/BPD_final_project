package com.example.billposting.infrastructure.user;

import com.example.billposting.domain.UserDetails;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

@Component
public class DemoUserServiceClient implements UserServiceClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String baseUrl;

    public DemoUserServiceClient(@Value("${app.services.user-base-url:}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public UserDetails getUserDetails(String username) {
        String normalized = username.trim();
        if (StringUtils.hasText(baseUrl)) {
            try {
                @SuppressWarnings("unchecked")
                ResponseEntity<Map> response = restTemplate.getForEntity(baseUrl + "/user/{username}", Map.class, normalized);
                Map body = response.getBody();
                if (body != null) {
                    String name = asString(body.get("name"));
                    String surname = asString(body.get("surname"));
                    String taxCode = asString(body.get("taxCode"));
                    String address = asString(body.get("address"));
                    String city = asString(body.get("city"));
                    Integer zipCode = asInteger(body.get("zipCode"));
                    String phone = asString(body.get("phone"));
                    String email = asString(body.get("email"));
                    return new UserDetails(normalized, name, surname, taxCode, address, city, zipCode, phone, email);
                }
            } catch (Exception exception) {
                // Fall back to the demo behavior when the external jar is not available.
            }
        }

        String fullName = normalized.replace('.', ' ').replace('_', ' ');
        String email = normalized.toLowerCase() + "@example.com";
        String phone = "+39-" + Math.abs(normalized.hashCode() % 1_000_000_000);
        return new UserDetails(normalized, fullName, email, phone);
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String text = String.valueOf(value);
        return StringUtils.hasText(text) ? Integer.valueOf(text) : null;
    }
}
