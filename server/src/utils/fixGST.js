const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGST() {
  const saleItems = await prisma.saleItem.findMany({
    where: { 
      OR: [
        { itemType: 'quick_bill' },
        { phoneId: { not: null } }
      ]
    },
    include: { sale: true }
  });

  console.log('Found ' + saleItems.length + ' phone sale items.');

  for (const item of saleItems) {
    if (item.unitCost > 0 && item.sellingPrice > 0) {
      const tRate = item.taxRate || 5.0;
      const inclusiveDifference = Math.max(0, item.finalPrice - item.unitCost);
      const taxableMargin = inclusiveDifference / (1 + (tRate / 100));
      const newTotalTax = Math.round((taxableMargin * (tRate / 100)) * 100) / 100;
      const newTaxableAmount = Math.round(taxableMargin * 100) / 100;
      
      let newCgst = 0, newSgst = 0, newIgst = 0;
      if (item.igst > 0) {
        newIgst = newTotalTax;
      } else {
        newCgst = Math.round((newTotalTax / 2) * 100) / 100;
        newSgst = Math.round((newTotalTax - newCgst) * 100) / 100;
      }

      const diffTaxable = newTaxableAmount - item.taxableAmount;
      const diffTotalTax = newTotalTax - item.totalTax;
      const diffCgst = newCgst - item.cgst;
      const diffSgst = newSgst - item.sgst;
      const diffIgst = newIgst - item.igst;

      if (diffTotalTax !== 0) {
        console.log(`Fixing Item ${item.id} (Sale ${item.saleId}): Old Tax ${item.totalTax}, New Tax ${newTotalTax}`);
        await prisma.$transaction([
          prisma.saleItem.update({
            where: { id: item.id },
            data: {
              taxableAmount: newTaxableAmount,
              totalTax: newTotalTax,
              cgst: newCgst,
              sgst: newSgst,
              igst: newIgst
            }
          }),
          prisma.sale.update({
            where: { id: item.saleId },
            data: {
              taxableAmount: { increment: diffTaxable },
              totalTax: { increment: diffTotalTax },
              cgst: { increment: diffCgst },
              sgst: { increment: diffSgst },
              igst: { increment: diffIgst }
            }
          })
        ]);
      }
    }
  }
  console.log('Fix complete.');
}

fixGST().catch(console.error).finally(() => process.exit(0));
