package it.univaq.disim.bpd.example.services;

import org.springframework.stereotype.Service;

@Service("myService")
public class MyService {

  public void helloWorldService() {
    System.out.println("Hello world from a service!");
  }
}