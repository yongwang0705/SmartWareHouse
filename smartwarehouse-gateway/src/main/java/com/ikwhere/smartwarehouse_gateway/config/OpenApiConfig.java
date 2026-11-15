package com.ikwhere.smartwarehouse_gateway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI gatewayOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("SmartWareHouse API Gateway")
                        .description("""
                                Aggregated API documentation. Use the service selector in
                                Swagger UI to browse the Order, Inventory and Production
                                Planning specifications.
                                """)
                        .version("1.0.0"))
                .servers(List.of(new Server()
                        .url("/")
                        .description("API Gateway origin")));
    }
}
