package com.example.billposting.domain;

public class UserDetails {

    private final String username;
    private final String fullName;
    private final String email;
    private final String phone;

    public UserDetails(String username, String fullName, String email, String phone) {
        this.username = username;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }

    public String getUsername() {
        return username;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }
}
