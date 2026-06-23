var system = java.lang.System;
system.out.println("=== Starting Zone Selection (Greedy) for " + username + " ===");

// Guard: the zones service must have returned a parseable, non-empty list.
var zonesList;
try {
    zonesList = JSON.parse(availableZonesJSON);
} catch (e) {
    zonesList = null;
}
if (zonesList == null || zonesList.length === 0) {
    var noZonesMsg = "The zones service returned no zones for format '" + posterFormat + "'.";
    system.out.println("[VALIDATION] " + noZonesMsg);
    execution.setVariable("errorCode", "NO_ZONES_AVAILABLE");
    execution.setVariable("errorMessage", noZonesMsg);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", noZonesMsg);
}

var selectedZones = [];
var totalPrice = 0.0;

for (var c = 0; c < cities.size(); c++) {
    var city = cities.get(c);
    system.out.println("- City: " + city + " | Max Budget: " + maxPrice);

    var cityZones = [];
    for (var i = 0; i < zonesList.length; i++) {
        if (zonesList[i].city === city) {
            cityZones.push(zonesList[i]);
        }
    }

    cityZones.sort(function(a, b) { return b.price - a.price; });

    var currentCityTotal = 0.0;
    for (var j = 0; j < cityZones.length; j++) {
        if (currentCityTotal + cityZones[j].price <= maxPrice) {
            selectedZones.push(cityZones[j]);
            currentCityTotal += cityZones[j].price;
            totalPrice += cityZones[j].price;
            system.out.println("  > Selected zone ID " + cityZones[j].id + " for " + cityZones[j].price);
        }
    }
}

// Guard: at least one zone must have been selected, otherwise the request cannot be fulfilled
// (city not served, or maxPrice lower than the cheapest zone).
if (selectedZones.length === 0) {
    var noPickMsg = "No zones could be selected for the given cities and budget (maxPrice=" + maxPrice + " per city).";
    system.out.println("[VALIDATION] " + noPickMsg);
    execution.setVariable("errorCode", "NO_AFFORDABLE_ZONES");
    execution.setVariable("errorMessage", noPickMsg);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", noPickMsg);
}

var selectedJSON = JSON.stringify(selectedZones);
execution.setVariable("selectedZonesJSON", selectedJSON);
execution.setVariable("selectedZonesSpin", S(selectedJSON));
execution.setVariable("totalPrice", totalPrice);
system.out.println("=== Final Total Cost: " + totalPrice + " ===");
