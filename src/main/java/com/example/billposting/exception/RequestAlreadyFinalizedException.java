package com.example.billposting.exception;

public class RequestAlreadyFinalizedException extends RuntimeException {

    public RequestAlreadyFinalizedException(String message) {
        super(message);
    }
}
