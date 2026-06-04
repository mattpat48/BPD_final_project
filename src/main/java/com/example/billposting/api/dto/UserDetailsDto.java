package com.example.billposting.api.dto;

public class UserDetailsDto {

    public String username;
    public String name;
    public String surname;
    public String taxCode;
    public String address;
    public String city;
    public Integer zipCode;
    public String fullName;
    public String email;
    public String phone;

    public UserDetailsDto() {
    }

    public UserDetailsDto(String username,
                          String name,
                          String surname,
                          String taxCode,
                          String address,
                          String city,
                          Integer zipCode,
                          String fullName,
                          String email,
                          String phone) {
        this.username = username;
        this.name = name;
        this.surname = surname;
        this.taxCode = taxCode;
        this.address = address;
        this.city = city;
        this.zipCode = zipCode;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }
}
