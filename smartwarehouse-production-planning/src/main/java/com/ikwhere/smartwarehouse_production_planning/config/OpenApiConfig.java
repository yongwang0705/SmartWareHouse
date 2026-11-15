package com.ikwhere.smartwarehouse_production_planning.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI productionPlanningOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("SmartWareHouse Production Planning API")
                        .description("""
                                Production plans, tasks, line scheduling, routings,
                                work centers, employees and the working calendar.
                                """)
                        .version("1.0.0"))
                .servers(List.of(new Server()
                        .url("/")
                        .description("Current origin (API Gateway or direct service)")));
    }
}
