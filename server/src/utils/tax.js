


function calculateInclusiveGst(inclusivePrice, gstRate = 18.0) {
  const price = Math.max(0, parseFloat(inclusivePrice) || 0);
  const rate = Math.max(0, parseFloat(gstRate) || 18.0);

  if (price === 0) {
    return {
      inclusivePrice: 0,
      taxableValue: 0,
      gstAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstRate: rate
    };
  }

  // Taxable Value = Inclusive Price * 100 / (100 + rate)
  const taxableValue = Math.round((price * 100 / (100 + rate)) * 100) / 100;
  const gstAmount = Math.round((price - taxableValue) * 100) / 100;

  const halfGst = Math.round((gstAmount / 2) * 100) / 100;
  const otherHalf = Math.round((gstAmount - halfGst) * 100) / 100;

  return {
    inclusivePrice: price,
    taxableValue,
    gstAmount,
    cgst: halfGst,
    sgst: otherHalf,
    igst: gstAmount,
    gstRate: rate
  };
}


function calculateAccessorySaleItem(sellingPriceInclusive, discountAmount = 0, gstRate = 18.0, isInterState = false) {
  const sPrice = Math.max(0, parseFloat(sellingPriceInclusive) || 0);
  const disc = Math.min(sPrice, Math.max(0, parseFloat(discountAmount) || 0));
  const finalPrice = Math.max(0, Math.round((sPrice - disc) * 100) / 100);

  // Extract taxable value and GST from the final discounted price
  const rate = Math.max(0, parseFloat(gstRate) || 18.0);
  const taxableValue = Math.round((finalPrice * 100 / (100 + rate)) * 100) / 100;
  const totalTax = Math.round((finalPrice - taxableValue) * 100) / 100;

  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = totalTax;
  } else {
    cgst = Math.round((totalTax / 2) * 100) / 100;
    sgst = Math.round((totalTax - cgst) * 100) / 100;
  }

  return {
    selling_price_inclusive: sPrice,
    discount: disc,
    final_price: finalPrice,
    taxable_amount: taxableValue,
    total_tax: totalTax,
    cgst,
    sgst,
    igst,
    gst_rate: rate,
    price_includes_gst: 1
  };
}


function calculateAccessoryPurchaseBatch(quantity, purchasePriceInclusive, gstRate = 18.0) {
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const unitInclusive = Math.max(0, parseFloat(purchasePriceInclusive) || 0);
  const rate = Math.max(0, parseFloat(gstRate) || 18.0);

  const unitTaxable = Math.round((unitInclusive * 100 / (100 + rate)) * 100) / 100;
  const unitGst = Math.round((unitInclusive - unitTaxable) * 100) / 100;

  const totalPurchaseValue = Math.round(qty * unitInclusive * 100) / 100;
  const totalTaxableValue = Math.round(qty * unitTaxable * 100) / 100;
  const totalGst = Math.round((totalPurchaseValue - totalTaxableValue) * 100) / 100;

  return {
    quantity: qty,
    unit_purchase_price_inclusive: unitInclusive,
    unit_taxable_value: unitTaxable,
    unit_gst: unitGst,
    total_purchase_value: totalPurchaseValue,
    total_taxable_value: totalTaxableValue,
    total_gst: totalGst,
    gst_rate: rate
  };
}

module.exports = {
  calculateInclusiveGst,
  calculateAccessorySaleItem,
  calculateAccessoryPurchaseBatch
};
