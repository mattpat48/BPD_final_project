// Zone selection with multiple, user-selectable strategies.
// The chosen algorithm is read from the `strategy` process variable, set inline on the initial
// request. If absent it defaults to GREEDY (most-expensive-first), the original behaviour.
// `maxPrice` is the budget PER CITY.
var system = java.lang.System;

var strategyName = (typeof strategy !== "undefined" && strategy != null && String(strategy).length > 0)
    ? String(strategy)
    : "GREEDY";
system.out.println("=== Zone Selection | strategy=" + strategyName + " | user=" + username + " ===");

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

function zonesForCity(city) {
    var r = [];
    for (var i = 0; i < zonesList.length; i++) {
        if (zonesList[i].city === city) { r.push(zonesList[i]); }
    }
    return r;
}
function asc(a, b)  { return a.price - b.price; }
function desc(a, b) { return b.price - a.price; }

// Greedy fill of a single city's budget using the given ordering comparator.
function pickGreedy(cityZones, budget, comparator) {
    var picked = [], tot = 0.0;
    cityZones.sort(comparator);
    for (var j = 0; j < cityZones.length; j++) {
        if (tot + cityZones[j].price <= budget) {
            picked.push(cityZones[j]);
            tot += cityZones[j].price;
        }
    }
    return picked;
}

function selectForCity(cityZones, budget, strat) {
    if (cityZones.length === 0) { return []; }

    // MAX_ZONES: cheapest first -> maximises the number of posted zones.
    if (strat === "MAX_ZONES") {
        return pickGreedy(cityZones, budget, asc);
    }

    // LOWEST_TOTAL: a single zone, the cheapest one -> minimises the spend.
    if (strat === "LOWEST_TOTAL") {
        cityZones.sort(asc);
        return (cityZones[0].price <= budget) ? [cityZones[0]] : [];
    }

    // BALANCED_COVERAGE: guarantee the cheapest zone (coverage), then spend what is left on
    // the most expensive affordable zones -> coverage + premium mix.
    if (strat === "BALANCED_COVERAGE") {
        cityZones.sort(asc);
        var picked = [], tot = 0.0;
        if (cityZones[0].price <= budget) {
            picked.push(cityZones[0]);
            tot += cityZones[0].price;
        }
        var rest = cityZones.slice(1).sort(desc);
        for (var k = 0; k < rest.length; k++) {
            if (tot + rest[k].price <= budget) {
                picked.push(rest[k]);
                tot += rest[k].price;
            }
        }
        return picked;
    }

    // GREEDY (default): premium spots first (most-expensive-first greedy fill).
    return pickGreedy(cityZones, budget, desc);
}

var selectedZones = [];
var totalPrice = 0.0;

for (var c = 0; c < cities.size(); c++) {
    var city = cities.get(c);
    var picked = selectForCity(zonesForCity(city), maxPrice, strategyName);
    for (var p = 0; p < picked.length; p++) {
        selectedZones.push(picked[p]);
        totalPrice += picked[p].price;
    }
    system.out.println("- " + city + " | budget " + maxPrice + " -> " + picked.length + " zone");
}

// Guard: at least one zone must have been selected, otherwise the request cannot be fulfilled.
if (selectedZones.length === 0) {
    var noPickMsg = "No zones could be selected for the given cities and budget (maxPrice=" + maxPrice + " per city, strategy=" + strategyName + ").";
    system.out.println("[VALIDATION] " + noPickMsg);
    execution.setVariable("errorCode", "NO_AFFORDABLE_ZONES");
    execution.setVariable("errorMessage", noPickMsg);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", noPickMsg);
}

var selectedJSON = JSON.stringify(selectedZones);
execution.setVariable("selectedZonesJSON", selectedJSON);
execution.setVariable("selectedZonesSpin", S(selectedJSON));
execution.setVariable("totalPrice", totalPrice);
execution.setVariable("usedStrategy", strategyName);
system.out.println("=== Total: " + totalPrice + " | zones: " + selectedZones.length + " | strategy: " + strategyName + " ===");
