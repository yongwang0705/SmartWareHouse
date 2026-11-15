package com.ikwhere.smartwarehouse_order_service.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI orderServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("SmartWareHouse Order Service API")
                        .description("""
                                Order lifecycle, stock confirmation, production hand-off,
                                warehouse storage and shipping.
                                """)
                        .version("1.0.0"))
                .servers(List.of(new Server()
                        .url("/")
                        .description("Current origin (API Gateway or direct service)")));
    }
}
