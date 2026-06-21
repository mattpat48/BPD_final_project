var system = java.lang.System;
var File = java.io.File;
var FileWriter = java.io.FileWriter;
var BufferedWriter = java.io.BufferedWriter;

try {
    var directory = new File("data/orders/confirmed");
    if (!directory.exists()) {
        directory.mkdirs();
    }

    var fileName = "data/orders/confirmed/order_" + requestId + ".txt";
    var fileWriter = new FileWriter(fileName);
    var bufferedWriter = new BufferedWriter(fileWriter);

    bufferedWriter.write("=== ORDER CONFIRMATION ===\n");
    bufferedWriter.write("Request ID     : " + requestId + "\n");
    bufferedWriter.write("Username       : " + username + "\n");
    bufferedWriter.write("Invoice Number : " + invoiceNumber + "\n");
    bufferedWriter.write("Total Amount   : " + amountDue + "\n");
    bufferedWriter.write("Format         : " + posterFormat + "\n");
    bufferedWriter.write("Selected Zones : " + selectedZonesJSON + "\n");
    bufferedWriter.write("==========================\n");

    bufferedWriter.close();
    system.out.println("Order file successfully created at: " + fileName);

} catch (e) {
    system.err.println("Error creating order file: " + e.message);
}