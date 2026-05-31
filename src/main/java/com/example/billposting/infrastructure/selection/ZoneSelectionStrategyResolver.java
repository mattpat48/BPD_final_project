package com.example.billposting.infrastructure.selection;

import com.example.billposting.exception.InvalidSelectionStrategyException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ZoneSelectionStrategyResolver {

    private final Map<String, ZoneSelectionStrategy> strategies = new HashMap<>();

    public ZoneSelectionStrategyResolver(List<ZoneSelectionStrategy> strategies) {
        for (ZoneSelectionStrategy strategy : strategies) {
            this.strategies.put(strategy.getName().toLowerCase(Locale.ROOT), strategy);
        }
    }

    public ZoneSelectionStrategy resolve(String strategyName) {
        ZoneSelectionStrategy strategy = strategies.get(strategyName.toLowerCase(Locale.ROOT));
        if (strategy == null) {
            throw new InvalidSelectionStrategyException("Unsupported selection strategy: " + strategyName);
        }
        return strategy;
    }
}
