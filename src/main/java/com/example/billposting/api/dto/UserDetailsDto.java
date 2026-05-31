package com.example.billposting.api.dto;

public class UserDetailsDto {

    public String username;
    public String fullName;
    public String email;
    public String phone;

    public UserDetailsDto() {
    }

    public UserDetailsDto(String username, String fullName, String email, String phone) {
        this.username = username;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }
}
