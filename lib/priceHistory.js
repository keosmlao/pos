export async function logPriceChange(client, productId, before, after, source = 'manual', note = null) {
  const costBefore = Number(before?.cost_price) || 0;
  const sellBefore = Number(before?.selling_price) || 0;
  const costAfter = Number(after.cost_price) || 0;
  const sellAfter = Number(after.selling_price) || 0;
  if (costBefore === costAfter && sellBefore === sellAfter) return;
  await client.query(
    `INSERT INTO price_history (product_id, cost_price_before, selling_price_before, cost_price_after, selling_price_after, source, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, costBefore, sellBefore, costAfter, sellAfter, source, note]
  );
}
