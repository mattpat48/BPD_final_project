package it.univaq.disim.bpd.example.delegates;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("myDelegate")
public class MyDelegate implements JavaDelegate {

  @Override
  public void execute(DelegateExecution execution) {
    System.out.println("Hello World from MyDelegate!");
  }
}