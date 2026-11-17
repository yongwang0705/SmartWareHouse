# SmartWarehouse Frontend

A responsive React + TypeScript + Tailwind CSS frontend for the SmartWarehouse distributed supply-chain project.

## Features

- Operations dashboard with order and production tracking tables plus order, inventory, value and low-stock metrics
- Order list with status filters and search
- Order lifecycle: create → confirm (stock is checked; covered orders reserve stock, shortages queue production) → complete after production is done
- Create orders with one or more inventory products and a delivery deadline; planning schedules earliest deadlines first and flags at-risk completions
- View order details
- Cancel orders; the backend releases reserved inventory through gRPC
- Inventory table showing on-hand, reserved and available quantities
- Inventory workspace: stock table plus a JIT Kanban tab with live bin status, replenishment columns and stock/deployment age
- JIT replenishment: create a draft production plan up to bin capacity directly from a low-stock kanban card
- Production completion adds finished goods to inventory and consumes the reserved BOM materials
- Warehouse footprint: physical sites, plot/bucket assignments to products or materials, surface area, occupancy and utilization; add new plots from the page, with occupancy derived from live inventory
- Production planning board: week-by-week timeline with previous/next navigation, generate draft plans from a chosen date and hour using production-line throughput, split orders into scheduled parts, add/edit/remove parts, inspect risk/shortage metrics, confirm or cancel plans
- Task lifecycle actions: start and complete production tasks from a plan or the Gantt view
- Gantt chart of production-line allocations, grouped by line, work center, employee or operation
- Resource management: production lines with headcount and units-per-hour throughput, work centers and the working calendar
- Production routing management: routing definitions and ordered operations with skills and processing times
- Responsive sidebar and mobile layout
- Loading, empty, success and API error states

## Splitting an order into production parts

1. Create the order with its delivery deadline, then confirm it (Orders → view order → Confirm).
2. Open Production → Planning board and generate a draft plan for a window covering the due date.
3. Open the drafted plan (Manage) and choose **Add production part**.
4. Select the customer order line, enter a **partial quantity**, start/end date-time and production line.
5. Repeat for additional parts on different days/hours; use Edit/Remove to adjust them.
6. Confirm the plan when the parts are arranged.

All parts stay in one plan and share the order; the order progresses as the parts complete. Splitting the same order across separate plans is not allocation-aware yet, so use multiple parts within one plan.

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
| POST | `/api/orders/{id}/confirm` | Confirm an order, check stock and reserve/queue production |
| POST | `/api/orders/{id}/complete` | Final order confirmation; consume and fulfil inventory |
| DELETE | `/api/orders/{id}` | Cancel an order |
| GET | `/api/inventory` | List inventory |
| GET | `/api/inventory/bom` | List inventory BOM records |
| GET | `/api/inventory/kanban` | JIT kanban bins with live status and age metrics |
| GET | `/api/inventory/warehouses` | Warehouses with plots, assignments and space utilization |
| POST | `/api/inventory/warehouses/{id}/plots` | Add a plot/bucket to a warehouse |
| GET | `/api/inventory/suppliers` | List suppliers |
| POST | `/api/inventory/suppliers` | Register a supplier |
| GET | `/api/inventory/purchase-orders` | List purchase orders with material lines |
| POST | `/api/inventory/purchase-orders` | Place a raw-material purchase order |
| POST | `/api/inventory/purchase-orders/{id}/receive` | Receive an order and add its materials to stock |
| POST | `/api/inventory/purchase-orders/{id}/cancel` | Cancel an ordered purchase order |
| GET | `/api/production/plans` | List production plans |
| POST | `/api/production/plans/generate` | Generate a draft plan |
| POST | `/api/production/plans/replenish` | Generate a draft replenishment plan up to a target quantity |
| POST | `/api/production/plans/{id}/tasks` | Add a scheduled production part to a draft plan |
| PUT | `/api/production/plans/{id}/tasks/{taskId}` | Modify a scheduled production part |
| DELETE | `/api/production/plans/{id}/tasks/{taskId}` | Remove a production part from a draft plan |
| GET | `/api/production/plans/{id}` | Plan details with tasks, assignments and materials |
| POST | `/api/production/plans/{id}/confirm` | Confirm a plan and reserve materials |
| POST | `/api/production/plans/{id}/cancel` | Cancel a plan and release reservations |
| GET | `/api/production/tasks?planId={id}` | List production tasks |
| POST | `/api/production/tasks/{id}/start` | Start a production task |
| POST | `/api/production/tasks/{id}/complete` | Complete a production task |
| GET | `/api/production/lines` | List production lines with headcount and units/hour |
| POST | `/api/production/lines` | Add a production line |
| PUT | `/api/production/lines/{id}` | Update a production line's capacity |
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

The backend supports Orders, Inventory and Production Planning, so those sections are connected. Products are listed in the Inventory page; there is no separate Products page. The Production workspace connects to the PPS service through the API Gateway, including plans, the Gantt chart, resources and routings. Warehouses is connected to the inventory service's physical layout data; Suppliers is connected to the inventory service's supplier and purchase-order API, including goods receipt into stock. Revenue is calculated from order totals and is an operational order-value metric, not a payment or accounting ledger.
