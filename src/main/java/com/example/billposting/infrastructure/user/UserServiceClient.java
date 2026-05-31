package com.example.billposting.infrastructure.user;

import com.example.billposting.domain.UserDetails;

public interface UserServiceClient {

    UserDetails getUserDetails(String username);
}
