package com.example.billposting.domain;

public class UserDetails {

    private final String username;
    private final String name;
    private final String surname;
    private final String taxCode;
    private final String address;
    private final String city;
    private final Integer zipCode;
    private final String fullName;
    private final String email;
    private final String phone;

    public UserDetails(String username, String fullName, String email, String phone) {
        this.username = username;
        this.name = null;
        this.surname = null;
        this.taxCode = null;
        this.address = null;
        this.city = null;
        this.zipCode = null;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
    }

    public UserDetails(String username,
                       String name,
                       String surname,
                       String taxCode,
                       String address,
                       String city,
                       Integer zipCode,
                       String phone,
                       String email) {
        this.username = username;
        this.name = name;
        this.surname = surname;
        this.taxCode = taxCode;
        this.address = address;
        this.city = city;
        this.zipCode = zipCode;
        this.fullName = buildFullName(name, surname);
        this.email = email;
        this.phone = phone;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }

    public String getSurname() {
        return surname;
    }

    public String getTaxCode() {
        return taxCode;
    }

    public String getAddress() {
        return address;
    }

    public String getCity() {
        return city;
    }

    public Integer getZipCode() {
        return zipCode;
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

    private String buildFullName(String name, String surname) {
        if (name == null || name.isEmpty()) {
            return surname;
        }
        if (surname == null || surname.isEmpty()) {
            return name;
        }
        return name + " " + surname;
    }
}
