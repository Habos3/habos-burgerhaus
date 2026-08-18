import { getStore } from "@netlify/blobs";

export default async (request) => {
  const store = getStore({
    name: "habos-orders",
    consistency: "strong"
  });

  if (request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Ungültige Daten." },
        { status: 400 }
      );
    }

    if (!body?.orderNo || !body?.orderText) {
      return Response.json(
        { error: "Bestellnummer oder Bestellung fehlt." },
        { status: 400 }
      );
    }

    const order = {
      orderNo: String(body.orderNo),
      shortOrderNo: String(
        body.shortOrderNo || String(body.orderNo).slice(-3)
      ),
      name: String(body.name || ""),
      phone: String(body.phone || ""),
      orderType: String(body.orderType || ""),
      address: String(body.address || ""),
      total: Number(body.total || 0),
      orderText: String(body.orderText || ""),
      createdAt: Number(body.createdAt || Date.now()),
      status: "pending",
      minutes: null,
      acceptedAt: null
    };

    await store.setJSON(
      `order/${order.orderNo}`,
      order,
      { onlyIfNew: true }
    );

    return Response.json({
      ok: true,
      orderNo: order.orderNo,
      shortOrderNo: order.shortOrderNo
    });
  }

  if (request.method === "GET") {
    const { blobs } = await store.list({
      prefix: "order/"
    });

    const orders = [];

    for (const blob of blobs) {
      const order = await store.get(blob.key, {
        type: "json",
        consistency: "strong"
      });

      if (order?.status === "pending") {
        orders.push(order);
      }
    }

    orders.sort(
      (a, b) => Number(a.createdAt) - Number(b.createdAt)
    );

    return Response.json({
      ok: true,
      orders
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  if (request.method === "PATCH") {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Ungültige Daten." },
        { status: 400 }
      );
    }

    const orderNo = String(body?.orderNo || "");
    const minutes = Number(body?.minutes);

    if (!orderNo || !Number.isFinite(minutes) || minutes <= 0) {
      return Response.json(
        { error: "Bestellnummer oder Minuten fehlen." },
        { status: 400 }
      );
    }

    const key = `order/${orderNo}`;

    const order = await store.get(key, {
      type: "json",
      consistency: "strong"
    });

    if (!order) {
      return Response.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      );
    }

    const updated = {
      ...order,
      status: "accepted",
      minutes,
      acceptedAt: Date.now()
    };

    await store.setJSON(key, updated);

    return Response.json({
      ok: true,
      order: updated
    });
  }

  return new Response("Method not allowed", {
    status: 405
  });
};

export const config = {
  path: "/.netlify/functions/orders"
};
