var system = java.lang.System;
system.out.println("=== Starting Zone Selection (Greedy) for " + username + " ===");

var zonesList = JSON.parse(availableZonesJSON);
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

var selectedJSON = JSON.stringify(selectedZones);
execution.setVariable("selectedZonesJSON", selectedJSON);
execution.setVariable("selectedZonesSpin", S(selectedJSON));
execution.setVariable("totalPrice", totalPrice);
system.out.println("=== Final Total Cost: " + totalPrice + " ===");