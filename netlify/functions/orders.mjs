import { getStore } from "@netlify/blobs";

const digits = (value) => String(value || "").replace(/\D/g, "");
const loyaltyKey = (phone) => `loyalty/${digits(phone)}`;
const REWARDS = {
  fries: { points: 500, name: "Pommes gratis" },
  medium_fries: { points: 750, name: "Medium Burger nach Wahl + Pommes" },
  classic_fries: { points: 1000, name: "Classic Burger nach Wahl + Pommes" },
  classic_menu_dip: { points: 1500, name: "Classic Menü nach Wahl + 1 Dip" }
};

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

    const phone = digits(body.phone);
    if (phone.length < 7) {
      return Response.json({ error: "Eine gültige Telefonnummer fehlt." }, { status: 400 });
    }

    const loyalty = await store.get(loyaltyKey(phone), {
      type: "json",
      consistency: "strong"
    }) || { phone, points: 0 };
    const eligibleAmount = Math.max(0, Number(body.eligibleAmount || 0));
    const rewardId = String(body.requestedRewardId || "");
    const requestedReward = REWARDS[rewardId];
    const reward = requestedReward && Number(loyalty.points || 0) >= requestedReward.points
      ? { id: rewardId, ...requestedReward }
      : null;

    const order = {
      orderNo: String(body.orderNo),
      shortOrderNo: String(
        body.shortOrderNo || String(body.orderNo).slice(-3)
      ),
      name: String(body.name || ""),
      phone,
      orderType: String(body.orderType || ""),
      address: String(body.address || ""),
      eligibleAmount,
      requestedReward: reward,
      total: Math.max(0, Number(body.total || 0)),
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
    const url = new URL(request.url);
    const loyaltyPhone = digits(url.searchParams.get("loyalty"));
    if (loyaltyPhone) {
      if (loyaltyPhone.length < 7) {
        return Response.json({ error: "Ungültige Telefonnummer." }, { status: 400 });
      }
      const loyalty = await store.get(loyaltyKey(loyaltyPhone), {
        type: "json",
        consistency: "strong"
      });
      return Response.json({ ok: true, points: Number(loyalty?.points || 0) }, {
        headers: { "Cache-Control": "no-store" }
      });
    }
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

    if (order.status === "accepted" && order.loyaltyAppliedAt) {
      return Response.json({ ok: true, order });
    }

    const phone = digits(order.phone);
    let loyaltyResult = null;
    if (phone.length >= 7) {
      const lKey = loyaltyKey(phone);
      const loyalty = await store.get(lKey, {
        type: "json",
        consistency: "strong"
      }) || { phone, points: 0, orders: 0 };
      const available = Math.max(0, Number(loyalty.points || 0));
      const requestedReward = order.requestedReward;
      const validReward = requestedReward && REWARDS[requestedReward.id];
      const redeemedPoints = validReward && available >= REWARDS[requestedReward.id].points
        ? REWARDS[requestedReward.id].points
        : 0;
      const earnedPoints = Math.floor(Math.max(0, Number(order.eligibleAmount || 0)) * 10);
      const newPoints = available - redeemedPoints + earnedPoints;
      loyaltyResult = {
        ...loyalty,
        phone,
        points: newPoints,
        orders: Number(loyalty.orders || 0) + 1,
        updatedAt: Date.now()
      };
      await store.setJSON(lKey, loyaltyResult);
      order.redeemedPoints = redeemedPoints;
      order.earnedPoints = earnedPoints;
      order.loyaltyBalanceAfter = newPoints;
      order.loyaltyAppliedAt = Date.now();
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
      order: updated,
      loyalty: loyaltyResult
    });
  }

  return new Response("Method not allowed", {
    status: 405
  });
};

export const config = {
  path: "/.netlify/functions/orders"
};
