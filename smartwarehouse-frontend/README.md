# SmartWarehouse Frontend

A responsive React + TypeScript + Tailwind CSS frontend for the SmartWarehouse distributed supply-chain project.

## Features

- Operations dashboard with order, inventory, value and low-stock metrics
- Order list with status filters and search
- Create orders with one or more inventory products
- View order details
- Cancel orders; the backend releases reserved inventory through gRPC
- Inventory table showing on-hand, reserved and available quantities
- JIT Kanban board with live bin status, replenishment columns and stock/deployment age
- Production planning board: generate draft plans, inspect risk/shortage metrics, view plan details, confirm or cancel plans
- Task lifecycle actions: start and complete production tasks from a plan or the Gantt view
- Gantt chart of allocated operations, grouped by work center, employee or operation
- Resource management: work centers, employees, skills, shifts, unavailability and the working calendar
- Production routing management: routing definitions and ordered operations with skills and processing times
- Responsive sidebar and mobile layout
- Loading, empty, success and API error states

## Requirements

- Node.js 20 or newer
- npm
- SmartWarehouse backend services running

## Install and run

```bash
npm install
```

Copy `.env.example` to `.env` and adjust the API Gateway URL if needed:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:5173>.

Create a production build:

```bash
npm run build
```

## Backend API integration

The frontend expects the API Gateway to expose these routes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/orders` | List orders |
| GET | `/api/orders/{id}` | Get order details |
| POST | `/api/orders` | Create an order |
| DELETE | `/api/orders/{id}` | Cancel an order |
| GET | `/api/inventory` | List inventory |
| GET | `/api/inventory/bom` | List inventory BOM records |
| GET | `/api/inventory/kanban` | JIT kanban bins with live status and age metrics |
| GET | `/api/production/plans` | List production plans |
| POST | `/api/production/plans/generate` | Generate a draft plan |
| GET | `/api/production/plans/{id}` | Plan details with tasks, assignments and materials |
| POST | `/api/production/plans/{id}/confirm` | Confirm a plan and reserve materials |
| POST | `/api/production/plans/{id}/cancel` | Cancel a plan and release reservations |
| GET | `/api/production/tasks?planId={id}` | List production tasks |
| POST | `/api/production/tasks/{id}/start` | Start a production task |
| POST | `/api/production/tasks/{id}/complete` | Complete a production task |
| GET | `/api/production/work-centers` | List work centers |
| POST | `/api/production/work-centers` | Create a work center |
| GET | `/api/production/employees` | List employees |
| POST | `/api/production/employees` | Create an employee |
| GET/POST | `/api/production/employees/{id}/skills` | List or add employee skills |
| GET/POST | `/api/production/employees/{id}/shifts` | List or add employee shifts |
| GET/POST | `/api/production/employees/{id}/unavailability` | List or add employee unavailability |
| GET | `/api/production/routings` | List production routings |
| POST | `/api/production/routings` | Create a routing |
| GET/POST | `/api/production/routings/{id}/operations` | List or add routing operations |
| GET | `/api/production/working-calendar?from=&to=` | Read the working calendar |
| POST | `/api/production/working-calendar` | Save a calendar entry |

The order request body is:

```json
{
  "customerId": 1001,
  "items": [
    { "productId": 101, "quantity": 2 }
  ]
}
```

Inventory items are expected to include `productId`, `productName`, `quantity`, and `reservedQuantity`. If `availableQuantity` is returned, it is used; otherwise the frontend calculates `quantity - reservedQuantity`.

Order records are expected to include `id`, `customerId`, `status`, `totalAmount`, `createdAt`, and `items`.

## CORS

If the browser reports a CORS error, configure CORS in the Spring Cloud API Gateway to allow the frontend origin `http://localhost:5173` for the required API routes. Prefer configuring CORS at the gateway rather than separately in each microservice.

## Current scope

The backend supports Orders, Inventory and Production Planning, so those sections are connected. Products are listed in the Inventory page; there is no separate Products page. The Production workspace connects to the PPS service through the API Gateway, including plans, the Gantt chart, resources and routings. Warehouses and Suppliers are roadmap placeholders until their backend services and APIs are implemented. Revenue is calculated from order totals and is an operational order-value metric, not a payment or accounting ledger.
