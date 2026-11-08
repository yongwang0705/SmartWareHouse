# SmartWarehouse Frontend

A responsive React + TypeScript + Tailwind CSS frontend for the SmartWarehouse distributed supply-chain project.

## Features

- Operations dashboard with order, inventory, value and low-stock metrics
- Order list with status filters and search
- Create orders with one or more inventory products
- View order details
- Cancel orders; the backend releases reserved inventory through gRPC
- Inventory table showing on-hand, reserved and available quantities
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

The current backend supports Orders and Inventory, so those sections are connected. Products are presented from inventory records. Warehouses and Suppliers are roadmap placeholders until their backend services and APIs are implemented. Revenue is calculated from order totals and is an operational order-value metric, not a payment or accounting ledger.
