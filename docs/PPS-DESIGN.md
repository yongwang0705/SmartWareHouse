# Production Planning System (PPS)
## Technical Design & Implementation Specification

**Project:** SmartWareHouse  
**Module:** SmartWarehouse Production Planning Service  
**Document:** PPS-DESIGN.md  
**Version:** 1.0  
**Status:** Development Specification  
**Architecture:** Microservices  
**Primary Communication:** REST + gRPC  
**Database:** PostgreSQL  
**Persistence:** Spring JDBC / JdbcTemplate  

---

# 1. Instructions for Claude Code

You are implementing a Production Planning System (PPS) as a new microservice inside the existing SmartWareHouse project.

Before writing any code:

1. Inspect the complete existing repository.
2. Read the existing README files and Docker Compose configuration.
3. Inspect the Order Service implementation.
4. Inspect the Inventory Service implementation.
5. Inspect existing protobuf definitions and gRPC configuration.
6. Identify the actual Spring Boot, Java, Maven and gRPC dependency versions.
7. Follow existing package naming, coding style and project conventions.

## Critical development rules

- Do not rewrite existing services.
- Do not replace JdbcTemplate with JPA.
- Do not introduce unnecessary frameworks.
- Do not duplicate Order or Inventory database tables.
- Do not access another microservice's database directly.
- Use gRPC for communication between PPS and backend services.
- Use REST for communication between Frontend and API Gateway.
- Preserve existing functionality.
- Do not invent existing classes, endpoints or database columns. Inspect them first.
- Implement incrementally and compile/test after each phase.
- Do not implement future features unless explicitly requested.
- Do not change existing API contracts without documenting the reason.

When an existing implementation differs from this document, first explain the difference and propose the smallest compatible modification.

---

# 2. Project Objective

Build an automated production planning system that generates production schedules based on:

1. Customer order due dates.
2. Product quantities.
3. Finished goods inventory.
4. Raw material availability.
5. Production routing.
6. Employee availability.
7. Employee skills.
8. Work center capacity.
9. Production operation dependencies.

The system must generate a production plan that minimizes late deliveries while respecting material and resource constraints.

The first release uses deterministic rule-based scheduling.

Machine learning and advanced mathematical optimization are explicitly outside the initial scope.

---

# 3. Existing Architecture

The existing SmartWareHouse project contains:

- API Gateway
- Order Service
- Inventory Service
- PostgreSQL
- React Frontend
- Docker Compose

Existing service responsibilities:

| Service | Responsibility |
|---|---|
| API Gateway | REST routing |
| Order Service | Customer orders and order items |
| Inventory Service | Product inventory and stock reservation |
| Production Planning Service | Production scheduling and resource allocation |

## 3.1 New service

Create:

`smartwarehouse-production-planning`

Use the same technology stack and conventions as the existing services.

Expected configuration:

- Spring Boot
- Java version compatible with the existing project
- Maven
- Spring JDBC
- PostgreSQL
- Spring gRPC
- Docker

Do not arbitrarily upgrade existing dependencies.

## 3.2 Database isolation

Create a separate database:

`production_db`

PPS owns all production planning data.

PPS must never directly query or update `order_db` or `inventory_db`.

## 3.3 Communication architecture

Frontend → API Gateway → PPS: REST

PPS → Order Service: gRPC

PPS → Inventory Service: gRPC

PPS → production_db: JdbcTemplate

The API Gateway should route:

`/api/production/**`

to the PPS service.

Use the existing Docker Compose network and service discovery conventions.

---

# 4. Business Concepts

## 4.1 Customer Order

A customer order represents a demand for finished products.

PPS receives eligible production orders from Order Service.

Each order contains:

- Order ID
- Customer ID
- Due date
- Priority
- Order items
- Product IDs
- Quantities

PPS must not own customer order information.

## 4.2 Finished Goods

Finished goods are products that have already been manufactured.

If sufficient finished goods are available, production should not be scheduled for those quantities.

Production quantity:

`Production Quantity = Order Quantity - Allocated Finished Goods`

The first release should support finished goods allocation as a planning calculation.

Actual finished goods reservation must use Inventory Service.

## 4.3 Raw Materials

Raw materials are the components required to manufacture products.

Examples:

- CPU
- Screen
- Battery
- Packaging
- Electronic components

PPS obtains material availability through Inventory Service.

## 4.4 Bill of Materials (BOM)

A BOM defines the materials required to manufacture one unit of a product.

Example:

Product: Laptop

| Material | Quantity per Unit |
|---|---:|
| CPU | 1 |
| Screen | 1 |
| Battery | 1 |

For 20 laptops:

- CPU: 20
- Screen: 20
- Battery: 20

The BOM must support multiple materials per product.

For the first release, use a single-level BOM. Multi-level BOM explosion is a future enhancement.

## 4.5 Production Routing

A routing defines the ordered operations required to manufacture a product.

Example:

Laptop:

1. Assembly
2. Testing
3. Packaging

Each operation defines:

- Operation sequence
- Operation name
- Required skill
- Work center
- Processing time per unit

Operations must execute in sequence.

## 4.6 Work Center

A work center represents a production facility or production group.

Examples:

- Assembly A
- Assembly B
- Testing A
- Packaging A

A work center has a maximum available capacity per working day.

## 4.7 Employee

An employee represents an available production worker.

An employee has:

- Employee number
- Name
- Active status
- Skills
- Proficiency
- Shift availability

Employees must not be assigned to overlapping operations.

---

# 5. Database Design

Use PostgreSQL and JdbcTemplate.

All tables must use appropriate primary keys, foreign keys, indexes and constraints.

Do not use JPA or Hibernate.

## 5.1 production_plan

Represents one generated production schedule.

Fields:

- id
- plan_number
- status
- planning_start
- planning_end
- algorithm
- created_at
- updated_at

Plan statuses:

- DRAFT
- VALIDATING
- VALIDATED
- CONFIRMED
- IN_PROGRESS
- COMPLETED
- CANCELLED
- FAILED

## 5.2 production_task

Represents production required for an order item.

Fields:

- id
- plan_id
- order_id
- product_id
- quantity
- due_date
- start_time
- end_time
- priority
- status
- created_at
- updated_at

Task statuses:

- PLANNED
- SCHEDULED
- AT_RISK
- MATERIAL_SHORTAGE
- CAPACITY_SHORTAGE
- CONFIRMED
- IN_PROGRESS
- COMPLETED
- CANCELLED

Order IDs are external references. Do not create foreign keys to order_db.

## 5.3 product_bom

Fields:

- id
- product_id
- material_product_id
- quantity_per_unit
- active
- created_at

Constraints:

- quantity_per_unit > 0
- unique product_id + material_product_id

## 5.4 production_routing

Fields:

- id
- product_id
- name
- active
- created_at

## 5.5 routing_operation

Fields:

- id
- routing_id
- sequence_number
- operation_name
- work_center_id
- skill_code
- minutes_per_unit
- setup_minutes

Constraints:

- minutes_per_unit >= 0
- setup_minutes >= 0
- unique routing_id + sequence_number

## 5.6 work_center

Fields:

- id
- code
- name
- capacity_hours_per_day
- active

## 5.7 employee

Fields:

- id
- employee_number
- name
- active

## 5.8 employee_skill

Fields:

- id
- employee_id
- skill_code
- proficiency

Unique constraint:

employee_id + skill_code

## 5.9 employee_shift

Fields:

- id
- employee_id
- shift_start
- shift_end
- working_days
- active

The implementation must support employees with different working schedules.

## 5.10 employee_unavailability

Fields:

- id
- employee_id
- start_time
- end_time
- reason

Used for vacation, leave and other unavailable periods.

## 5.11 production_resource_assignment

Fields:

- id
- production_task_id
- operation_id
- work_center_id
- employee_id
- start_time
- end_time
- allocated_hours
- status

This table records employee and work center allocation.

## 5.12 production_material_requirement

Fields:

- id
- production_task_id
- material_product_id
- required_quantity
- reserved_quantity
- status

## 5.13 production_working_calendar

Fields:

- id
- work_date
- working_day
- start_time
- end_time
- description

This defines the production calendar.

---

# 6. gRPC Integration

All communication with Order Service and Inventory Service must use gRPC.

First inspect existing protobuf files.

Reuse existing definitions wherever possible.

Do not create duplicate protobuf services.

## 6.1 Order Service integration

PPS needs to retrieve orders eligible for production planning.

Required logical operations:

### GetPendingProductionOrders

Input:

- planning start date
- planning end date

Output:

- order ID
- customer ID
- due date
- priority
- order items
- product IDs
- quantities
- current production status

### UpdateProductionStatus

Input:

- order ID
- production status

Output:

- success
- message

Possible order production statuses:

- PENDING_PRODUCTION
- PLANNED
- IN_PRODUCTION
- PRODUCTION_COMPLETED

Important:

Inspect the current Order Service status model before implementing these operations.

Do not assume that these statuses already exist.

The current Order Service may require a minimal extension to support production-related states.

Do not break existing order creation, cancellation or inventory reservation behavior.

## 6.2 Inventory Service integration

PPS needs the following logical operations:

### GetInventoryBatch

Input:

- repeated product IDs

Output:

- product ID
- product name
- total quantity
- reserved quantity
- available quantity

### ReserveMaterials

Input:

- reservation reference
- material IDs
- requested quantities

Output:

- success
- message

### ReleaseMaterials

Input:

- reservation reference
- material IDs
- quantities

Output:

- success
- message

The reservation reference must be unique and idempotent.

Inventory Service must perform the batch reservation atomically within its own database transaction.

If any material cannot be reserved, none of the materials in that batch should remain reserved.

The implementation must be compatible with the current Inventory Service reservation model.

If inventory categories or material types do not exist, document the minimal required extension.

Do not directly modify inventory_db from PPS.

## 6.3 gRPC configuration

Follow the existing gRPC configuration conventions.

For Docker deployment, use Docker service DNS names rather than localhost.

For example:

- `order-service`
- `inventory-service`

Actual service names must be confirmed from docker-compose.yml.

Use plaintext only when consistent with the existing internal Docker network configuration.

Do not assume TLS is enabled.

---

# 7. Scheduling Algorithm

Implement the first version using deterministic rule-based scheduling.

Class:

`SchedulingEngine`

The algorithm must be separated from controllers and repositories.

## 7.1 Order sorting

Use the following priority:

1. HIGH
2. NORMAL
3. LOW

Within the same priority:

1. Earliest due date first.
2. Earlier order creation time first.
3. Lower order ID first as a deterministic tie-breaker.

The scheduling algorithm must produce the same result for identical input data.

## 7.2 Production quantity calculation

For each order item:

`Production Quantity = Order Quantity - Available Finished Goods Allocated`

Production quantity must never be negative.

Do not double-count finished goods already allocated to other orders.

## 7.3 Material calculation

For each production task:

`Required Material = Production Quantity × BOM Quantity Per Unit`

Calculate the total requirement for each material across the complete planning batch.

Check:

`Available Material >= Required Material`

If insufficient:

- Mark the affected production task MATERIAL_SHORTAGE.
- Record the shortage quantity.
- Explain which materials are missing.
- Do not reserve unavailable materials.

Do not silently remove an order from the plan.

## 7.4 Processing time

For each operation:

`Processing Minutes = Setup Minutes + Production Quantity × Minutes Per Unit`

Convert minutes into hours when allocating capacity.

## 7.5 Resource allocation

For each operation:

1. Find active work centers.
2. Check work center capacity.
3. Find active employees with the required skill.
4. Check employee shift availability.
5. Check employee unavailability.
6. Check existing task assignments.
7. Find the earliest available time slot.
8. Allocate the operation.
9. Update temporary scheduling capacity.
10. Continue to the next operation.

Do not allow:

- Employee double booking.
- Work center capacity overbooking.
- Operation sequence violations.
- Production outside working hours.
- Negative capacity.

For the first version, schedule operations in sequence.

An operation must not begin until the preceding operation has completed.

## 7.6 Due date validation

Calculate:

`Estimated Completion = End Time Of Final Operation`

If completion is later than the due date:

Mark task as AT_RISK.

Store:

- estimated completion
- due date
- delay duration
- risk reason

## 7.7 Unscheduled tasks

If no valid resource allocation is possible:

Mark the task as CAPACITY_SHORTAGE.

Record the reason.

The system must still return a complete planning result.

Do not fail the entire planning process because one task cannot be scheduled.

---

# 8. Planning Workflow

The planning process has two separate operations.

## 8.1 Generate Plan

Endpoint:

POST /api/production/plans/generate

Process:

1. Retrieve eligible orders through Order Service gRPC.
2. Retrieve required inventory through Inventory Service gRPC.
3. Load BOM definitions.
4. Load production routing.
5. Load employees and skills.
6. Load work center capacity.
7. Load working calendars and employee availability.
8. Sort orders.
9. Calculate production quantities.
10. Calculate material requirements.
11. Allocate production resources.
12. Calculate estimated completion dates.
13. Identify risks and shortages.
14. Save a DRAFT production plan.
15. Return planning results.

Generating a plan must not reserve inventory.

Generating a plan must not change order production status.

Generating a plan must not start production.

## 8.2 Confirm Plan

Endpoint:

POST /api/production/plans/{id}/confirm

Process:

1. Verify the plan exists.
2. Verify the plan is DRAFT or VALIDATED.
3. Verify all required task and material data.
4. Revalidate material availability through Inventory Service.
5. Request atomic batch material reservation.
6. If reservation fails, keep the plan unconfirmed.
7. If reservation succeeds, persist reservation references.
8. Update the plan to CONFIRMED.
9. Update eligible order production statuses through Order Service.
10. Return confirmation result.

Do not mark a plan CONFIRMED before successful material reservation.

Do not assume that multiple gRPC calls are one distributed transaction.

If a remote operation succeeds but the local database update fails, the system must have a compensation or reconciliation strategy.

For the first version:

- Implement reservation references.
- Implement release operations.
- Record failures.
- Do not silently ignore compensation failures.

A durable Saga and Transactional Outbox are future improvements, but the initial design must not make them impossible.

---

# 9. REST API

Expose the following endpoints through PPS.

## Planning Plans

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/production/plans/generate | Generate a draft plan |
| GET | /api/production/plans | List plans |
| GET | /api/production/plans/{id} | Plan details |
| POST | /api/production/plans/{id}/confirm | Confirm a plan |
| POST | /api/production/plans/{id}/cancel | Cancel a plan |

## Production Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/production/tasks | List tasks |
| GET | /api/production/tasks/{id} | Task details |
| POST | /api/production/tasks/{id}/start | Start production |
| POST | /api/production/tasks/{id}/complete | Complete production |

## Production Configuration

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/production/resources | List resources |
| GET | /api/production/work-centers | List work centers |
| POST | /api/production/work-centers | Create work center |
| GET | /api/production/employees | List employees |
| POST | /api/production/employees | Create employee |
| GET | /api/production/routings | List routings |
| POST | /api/production/routings | Create routing |
| GET | /api/production/bom/{productId} | Get BOM |
| POST | /api/production/bom | Create BOM |

Use DTOs for all REST responses.

Never expose database entities directly.

Use appropriate HTTP status codes:

- 200 OK
- 201 CREATED
- 400 BAD REQUEST
- 404 NOT FOUND
- 409 CONFLICT
- 500 INTERNAL SERVER ERROR

Use the existing exception handling conventions where appropriate.

---

# 10. Example REST Requests

## 10.1 Generate Plan

POST `/api/production/plans/generate`

```json
{
  "planningStart": "2026-11-12",
  "planningEnd": "2026-11-30",
  "algorithm": "PRIORITY_EARLIEST_DUE_DATE"
}
```

Example response:

```json
{
  "planId": 1,
  "status": "DRAFT",
  "totalOrders": 12,
  "scheduledOrders": 8,
  "atRiskOrders": 2,
  "materialShortageOrders": 1,
  "capacityShortageOrders": 1
}
```

## 10.2 Confirm Plan

POST `/api/production/plans/1/confirm`

Example response:

```json
{
  "planId": 1,
  "status": "CONFIRMED",
  "message": "Production plan confirmed successfully"
}
```

## 10.3 Get Plan Details

GET `/api/production/plans/1`

Example response:

```json
{
  "planId": 1,
  "planNumber": "PLAN-2026-0001",
  "status": "DRAFT",
  "tasks": [
    {
      "taskId": 1001,
      "orderId": 5001,
      "productId": 101,
      "quantity": 20,
      "startTime": "2026-11-12T08:00:00",
      "endTime": "2026-11-13T16:00:00",
      "dueDate": "2026-11-15T17:00:00",
      "status": "SCHEDULED"
    }
  ]
}
```

These examples are illustrative. Implement response fields consistently across the actual DTOs.

---

# 11. Frontend Requirements

The existing React frontend should eventually contain a Production Planning module.

Do not implement frontend in the first backend milestone unless explicitly requested.

Expected pages:

## 11.1 Planning Board

Display:

- Total pending orders
- Scheduled orders
- At-risk orders
- Material shortages
- Capacity shortages

Actions:

- Generate Plan
- View Plan
- Confirm Plan
- Recalculate Plan

## 11.2 Gantt Chart

Display production tasks across a timeline.

Group by:

- Work center
- Production operation
- Employee

Show:

- Start time
- End time
- Order number
- Product
- Quantity
- Status

## 11.3 Resource Management

Manage:

- Employees
- Skills
- Shifts
- Work centers
- Working calendar

## 11.4 Production Routing

Manage:

- Product routing
- Operation sequence
- Work center
- Required skill
- Processing time

---

# 12. Docker Integration

Add the PPS service to the existing root docker-compose.yml.

Requirements:

- Separate container.
- Separate production_db database.
- Same existing Docker network.
- PostgreSQL health dependency.
- Correct service DNS names.
- Environment variables for credentials.
- No passwords committed to Git.

Use the actual existing Compose service names.

Do not change existing container ports without a clear reason.

PPS REST port and gRPC port must not conflict with existing services.

Update `.env.example` with the required configuration keys.

---

# 13. Testing Requirements

Use the existing test framework and conventions.

## 13.1 Unit Tests

SchedulingEngine must have unit tests covering:

1. HIGH priority before NORMAL.
2. Earlier due date before later due date.
3. Finished goods reduce production quantity.
4. Insufficient material produces MATERIAL_SHORTAGE.
5. Insufficient work center capacity produces CAPACITY_SHORTAGE.
6. Employee without required skill cannot be assigned.
7. Employee cannot be double-booked.
8. Work center cannot exceed capacity.
9. Operations must execute in sequence.
10. Late completion produces AT_RISK.
11. Identical inputs produce deterministic results.

## 13.2 Integration Tests

Test:

- Order gRPC client.
- Inventory gRPC client.
- Database repositories.
- Generate Plan API.
- Confirm Plan API.
- Material reservation failure.
- Plan cancellation.
- Error handling.

## 13.3 End-to-End Test Scenario

Create the following test data:

Orders:

| Order | Product | Quantity | Due Date | Priority |
|---|---|---:|---|---|
| O1001 | Laptop | 20 | Nov 15 | HIGH |
| O1002 | Keyboard | 100 | Nov 14 | NORMAL |
| O1003 | Mouse | 200 | Nov 13 | HIGH |

Resources:

- Assembly A: 8 hours/day
- Testing A: 8 hours/day
- Packaging A: 8 hours/day

Employees:

- Employee A: Assembly
- Employee B: Testing
- Employee C: Packaging

Test procedure:

1. Create the required BOMs.
2. Create production routings.
3. Create work centers.
4. Create employees and skills.
5. Configure employee shifts.
6. Create eligible customer orders.
7. Generate a production plan.
8. Verify task sorting.
9. Verify material requirements.
10. Verify employee allocation.
11. Verify work center capacity.
12. Verify due date risks.
13. Confirm the plan.
14. Verify inventory reservations.
15. Start a production task.
16. Complete a production task.
17. Verify production status updates.

All tests must be repeatable.

Do not depend on manually prepared production data without documenting the setup.

---

# 14. Development Phases

Implement in the following order.

## Phase 1 — Service Foundation

- Inspect repository.
- Create PPS Spring Boot project.
- Configure Maven dependencies.
- Configure application.yml.
- Configure PostgreSQL.
- Configure JdbcTemplate.
- Create schema.sql.
- Add Dockerfile.
- Add Docker Compose service.

Acceptance criteria:

- PPS compiles.
- PPS starts.
- PPS connects to production_db.
- Existing services still work.

## Phase 2 — gRPC Integration

- Inspect existing protobuf files.
- Add only necessary Order Service contracts.
- Add only necessary Inventory Service contracts.
- Generate Java gRPC classes.
- Implement OrderGrpcClient.
- Implement InventoryGrpcClient.
- Add required server implementations in the owning services.
- Test communication.

Acceptance criteria:

- PPS can retrieve eligible orders.
- PPS can retrieve inventory.
- PPS can request material reservation.
- Existing Order and Inventory REST APIs continue working.

## Phase 3 — Production Configuration

Implement:

- Work centers
- Employees
- Employee skills
- Employee shifts
- Working calendar
- BOM
- Production routing
- Routing operations

Acceptance criteria:

- Configuration can be created and retrieved through REST.
- Database constraints are enforced.
- Repository and service tests pass.

## Phase 4 — Scheduling Engine

Implement:

- Order prioritization.
- Finished goods allocation calculation.
- BOM material calculation.
- Material availability validation.
- Operation time calculation.
- Work center capacity allocation.
- Employee skill allocation.
- Shift validation.
- Due date risk detection.

Acceptance criteria:

- All scheduling unit tests pass.
- Results are deterministic.
- Scheduling does not reserve inventory.
- Unscheduled tasks contain clear reasons.

## Phase 5 — Planning Workflow

Implement:

- Generate draft plan.
- Save tasks.
- Retrieve plan.
- Confirm plan.
- Reserve materials.
- Update order production status.
- Cancel plan.
- Release reservations where appropriate.
- Record failures and compensation results.

Acceptance criteria:

- Draft generation does not modify inventory.
- Confirmation reserves materials.
- Failed reservation does not confirm the plan.
- Duplicate confirmation is handled safely.
- Cancellation does not silently leave reservations behind.

## Phase 6 — Frontend

Implement Planning Board, Gantt Chart and resource management pages.

This phase is independent of the initial backend implementation.

---

# 15. Non-Functional Requirements

## Reliability

- gRPC calls must have sensible deadlines.
- Handle unavailable downstream services.
- Handle database failures.
- Avoid silent failure.
- Record errors with useful context.

## Concurrency

- Prevent simultaneous confirmation of the same plan.
- Prevent duplicate material reservations.
- Prevent overlapping employee assignments.
- Prevent work center overbooking.

Use database transactions and appropriate locking or conditional updates.

## Idempotency

Confirmation and material reservation operations must be idempotent.

A repeated request must not reserve the same materials twice.

Use unique reservation references and database constraints.

## Time

Use a consistent timezone policy.

Store timestamps consistently and avoid mixing local time and UTC.

Production schedules should use the configured plant timezone.

## Security

Follow existing API Gateway and authentication conventions.

Do not expose internal gRPC ports publicly unless required.

Do not commit credentials.

---

# 16. Explicitly Out of Scope for Version 1

Do not implement:

- Machine learning demand prediction.
- Genetic algorithm scheduling.
- AI-based scheduling.
- Multi-factory optimization.
- Multi-level BOM explosion.
- Automatic procurement.
- IoT machine monitoring.
- Complex production costing.
- Advanced preventive maintenance.

These may be future extensions.

---

# 17. Expected Deliverables

The implementation must provide:

1. New PPS Maven project.
2. Production database schema.
3. JdbcTemplate repositories.
4. REST controllers.
5. DTOs and validation.
6. Order gRPC client and required Order Service extension.
7. Inventory gRPC client and required Inventory Service extension.
8. SchedulingEngine.
9. Resource allocation implementation.
10. Planning workflow.
11. Unit and integration tests.
12. Dockerfile.
13. Docker Compose integration.
14. README with setup and testing instructions.
15. Example API requests.

---

# 18. Instructions for Incremental Execution

Do not implement all phases in one large change.

Work phase by phase.

For each phase:

1. Inspect the existing code.
2. Explain the proposed changes.
3. List files to create or modify.
4. Implement the changes.
5. Run Maven compilation.
6. Run relevant tests.
7. Report the results.
8. Identify any required manual configuration.
9. Wait for approval before starting the next phase.

If an existing design prevents implementation, explain the problem and propose the smallest compatible solution.

Do not report tests as successful unless they have actually been executed.

## First task

Start with Phase 1 only.

Inspect the existing SmartWareHouse repository and report:

- Existing service names.
- Existing Java and Spring Boot versions.
- Existing gRPC configuration.
- Existing Docker Compose service names.
- Existing database configuration.
- Recommended PPS port numbers.
- Exact files that need to be created or modified.

Then propose the Phase 1 implementation.

Do not start Phase 2 until Phase 1 has been completed and verified.

---

**End of Specification**