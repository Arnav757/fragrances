import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrder, getOrderDetail, createCustomerRequest } from "@/lib/services/orders";
import { quoteCartById } from "@/lib/services/cart";
import { ensureGatewayOrder, confirmCheckoutPayment } from "@/lib/services/payments";
import { getMockGateway } from "@/lib/payments/gateway";
import {
  changeOrderStatus,
  createSupplierPurchase,
  FulfillmentError,
  markPurchaseConfirmed,
  markPurchaseOrdered,
  recordRefund,
  recordShipment,
  resolveRequest,
  supplierOrderMessage,
} from "@/lib/services/fulfillment";
import { financialReport } from "@/lib/services/reports";
import { checkoutInput, createUser, makeCart } from "../helpers";

let admin: { id: string };
let supplierId: string;

beforeAll(async () => {
  admin = { id: await createUser("ops@example.com", "admin") };
  supplierId = (await db()<{ id: string }[]>`select id from suppliers limit 1`)[0]!.id;
});
afterAll(async () => {
  await db().end();
});

async function paidOrder(slug = "atelier-demo-no-7-saffron-leather-50ml", qty = 1) {
  const cartId = await makeCart([{ slug, qty }]);
  const total = (await quoteCartById(cartId, { placeOfSupplyState: "Maharashtra" })).pricing.totalPaise;
  const o = await createOrder(checkoutInput({ expectedTotalPaise: total, email: "fulfil@example.com" }), { user: null, cartId });
  const mock = getMockGateway()!;
  const { gatewayOrderId } = await ensureGatewayOrder(o.id, mock);
  await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId, ...mock.simulate(gatewayOrderId) });
  return (await getOrderDetail({ id: o.id }))!;
}

describe("supplier fulfilment workflow", () => {
  it("runs the full manual dropship flow", async () => {
    const o = await paidOrder();
    const item = o.items[0]!;
    const poId = await createSupplierPurchase(o.id, { supplierId, items: [{ orderItemId: item.id, quantity: 1, unitCostPaise: 65000 }], costsIncludeGst: true }, admin);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("awaiting_supplier_purchase");

    // Can't over-purchase
    await expect(createSupplierPurchase(o.id, { supplierId, items: [{ orderItemId: item.id, quantity: 1, unitCostPaise: 1 }] }, admin)).rejects.toBeInstanceOf(FulfillmentError);

    // Supplier message has what's needed and nothing more
    const msg = await supplierOrderMessage(poId);
    expect(msg).toContain("1 Test Street");
    expect(msg).toContain("9876543210");
    expect(msg).toContain("PREPAID");
    expect(msg).not.toContain("fulfil@example.com");
    expect(msg).not.toMatch(/₹\s?1,299|1299/); // no selling price

    // Sharing customer data requires explicit confirmation
    await expect(markPurchaseOrdered(poId, { confirmDataShare: false }, admin)).rejects.toBeInstanceOf(FulfillmentError);
    await markPurchaseOrdered(poId, { confirmDataShare: true, supplierReference: "WH-77" }, admin);
    const po = (await db()<{ status: string; customerDataSharedBy: string; supplierReference: string }[]>`select status, customer_data_shared_by, supplier_reference from supplier_purchase_orders where id = ${poId}`)[0]!;
    expect(po).toMatchObject({ status: "ordered", customerDataSharedBy: admin.id, supplierReference: "WH-77" });
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("supplier_ordered");

    await markPurchaseConfirmed(poId, admin);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("supplier_confirmed");

    await expect(recordShipment(o.id, { poId, courier: "Delhivery", trackingNumber: "BAD TRACK!", notify: false }, admin)).rejects.toThrow();
    await recordShipment(o.id, { poId, courier: "Delhivery", trackingNumber: "AWB123", trackingUrl: "https://example.com/t/AWB123" }, admin);
    const shipped = (await getOrderDetail({ id: o.id }))!;
    expect(shipped.status).toBe("shipped");
    expect(shipped.shipments[0]!.trackingNumber).toBe("AWB123");
    expect((await db()`select 1 from email_outbox where order_id = ${o.id} and template = 'order_dispatched'`).length).toBe(1);

    await changeOrderStatus(o.id, "delivered", admin, null, true);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("delivered");
    const audits = await db()`select action from audit_logs where entity_id = ${o.id} or metadata->>'orderId' = ${o.id}`;
    expect(audits.length).toBeGreaterThanOrEqual(4);

    // Customer requests a return; admin rejects → back to delivered
    await createCustomerRequest(o.id, null, "return", "Bottle arrived cracked");
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("return_requested");
    const req = (await db()<{ id: string }[]>`select id from order_requests where order_id = ${o.id}`)[0]!;
    await resolveRequest(req.id, "rejected", "Please send photos", admin);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("delivered");
  });

  it("enforces valid transitions and won't confirm unpaid online orders", async () => {
    const o = await paidOrder();
    await expect(changeOrderStatus(o.id, "delivered", admin, null, false)).rejects.toBeInstanceOf(FulfillmentError);
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const total = (await quoteCartById(cartId, { placeOfSupplyState: "Maharashtra" })).pricing.totalPaise;
    const unpaid = await createOrder(checkoutInput({ expectedTotalPaise: total }), { user: null, cartId });
    await expect(changeOrderStatus(unpaid.id, "confirmed", admin, null, false)).rejects.toThrow(/after its payment is verified/);
    await expect(createSupplierPurchase(unpaid.id, { supplierId, items: [{ orderItemId: (await getOrderDetail({ id: unpaid.id }))!.items[0]!.id, quantity: 1, unitCostPaise: 1 }] }, admin)).rejects.toBeInstanceOf(FulfillmentError);
  });

  it("handles cancellation requests and refunds without exceeding the amount paid", async () => {
    const o = await paidOrder();
    await createCustomerRequest(o.id, null, "cancellation", "Ordered by mistake");
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("cancellation_requested");
    const req = (await db()<{ id: string }[]>`select id from order_requests where order_id = ${o.id} and type = 'cancellation'`)[0]!;
    await resolveRequest(req.id, "approved", "Cancelled as requested", admin);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("cancelled");

    await expect(recordRefund(o.id, { amountPaise: o.totalPaise + 1, reason: "too much", viaGateway: false }, admin)).rejects.toBeInstanceOf(FulfillmentError);
    await recordRefund(o.id, { amountPaise: 10000, reason: "partial", viaGateway: true }, admin);
    let d = (await getOrderDetail({ id: o.id }))!;
    expect(d.paymentStatus).toBe("partially_refunded");
    await recordRefund(o.id, { amountPaise: o.totalPaise - 10000, reason: "rest", viaGateway: false }, admin);
    d = (await getOrderDetail({ id: o.id }))!;
    expect(d.paymentStatus).toBe("refunded");
    expect(d.status).toBe("refunded");
    await expect(recordRefund(o.id, { amountPaise: 1, reason: "again", viaGateway: false }, admin)).rejects.toBeInstanceOf(FulfillmentError);
    expect((await db()`select 1 from email_outbox where order_id = ${o.id} and template = 'refund_status'`).length).toBe(2);
  });

  it("produces a financial report that separates revenue, GST and costs", async () => {
    const from = new Date(Date.now() - 86400_000);
    const to = new Date(Date.now() + 86400_000);
    const r = await financialReport(from, to);
    expect(r.grossSalesPaise).toBeGreaterThan(0);
    expect(r.revenueExTaxPaise).toBeLessThan(r.grossSalesPaise);
    expect(r.ordersMissingCosts).toBeGreaterThan(0); // orders without supplier purchases are flagged, not hidden
    expect(r.grossProfitPaise).toBe(Math.round(r.revenueExTaxPaise - r.costsExRecoverableGstPaise - r.costGstNotRecoverablePaise));
    expect(r.contributionPaise).toBe(Math.round(r.grossProfitPaise - r.paymentFeesPaise - r.expensesPaise));
  });

  it("counts GST on supplier costs exactly once in gross profit", async () => {
    const from = new Date(Date.now() - 86400_000);
    const to = new Date(Date.now() + 86400_000);
    const cases = [
      // GST included in the price and reclaimable: cost is the price less GST
      { costsIncludeGst: true, itcEligible: true, productCostPaise: 50000, shippingCostPaise: 5000, gstOnCostsPaise: 8390, cost: 46610 },
      // GST included and not reclaimable: the full price is the cost
      { costsIncludeGst: true, itcEligible: false, productCostPaise: 50000, shippingCostPaise: 5000, gstOnCostsPaise: 8390, cost: 55000 },
      // GST charged on top and reclaimable: the price is the cost
      { costsIncludeGst: false, itcEligible: true, productCostPaise: 50000, shippingCostPaise: 0, gstOnCostsPaise: 9000, cost: 50000 },
      // GST charged on top and not reclaimable: price plus GST
      { costsIncludeGst: false, itcEligible: false, productCostPaise: 50000, shippingCostPaise: 0, gstOnCostsPaise: 9000, cost: 59000 },
    ];
    for (const c of cases) {
      const o = await paidOrder();
      const before = await financialReport(from, to);
      await createSupplierPurchase(
        o.id,
        {
          supplierId,
          items: [{ orderItemId: o.items[0]!.id, quantity: 1, unitCostPaise: c.productCostPaise }],
          shippingCostPaise: c.shippingCostPaise,
          costsIncludeGst: c.costsIncludeGst,
          gstOnCostsPaise: c.gstOnCostsPaise,
          itcEligible: c.itcEligible,
        },
        admin,
      );
      const after = await financialReport(from, to);
      expect(before.grossProfitPaise - after.grossProfitPaise).toBe(c.cost);
      expect(before.revenueExTaxPaise).toBe(after.revenueExTaxPaise);
    }
  });
});
