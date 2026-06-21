var system = java.lang.System;
var File = java.io.File;
var FileWriter = java.io.FileWriter;
var BufferedWriter = java.io.BufferedWriter;

system.out.println("\n==========================================");
system.out.println("ORDER CANCELLED");
system.out.println("Request ID : " + requestId);
system.out.println("The bill has been voided.");
system.out.println("==========================================\n");

try {
    var directory = new File("data/orders/cancelled");
    if (!directory.exists()) {
        directory.mkdirs();
    }

    // Creates an empty bill file
    var fileName = "data/orders/cancelled/order_" + requestId + "_CANCELLED.txt";
    var fileWriter = new FileWriter(fileName);
    var bufferedWriter = new BufferedWriter(fileWriter);

    bufferedWriter.write("=== ORDER CANCELLED ===\n");
    bufferedWriter.write("Request ID     : " + requestId + "\n");
    bufferedWriter.write("Username       : " + username + "\n");
    bufferedWriter.write("Status         : CANCELLED\n");
    bufferedWriter.write("Amount Due     : 0.0\n");
    bufferedWriter.write("==========================\n");

    bufferedWriter.close();
    system.out.println("Cancellation file successfully created at: " + fileName);

} catch (e) {
    system.err.println("Error creating cancellation file: " + e.message);
}