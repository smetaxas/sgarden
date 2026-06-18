import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/jwt';
import { Order } from '../models/Order';

const router = Router();

// GET /api/analytics/sales
router.get('/sales', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate)   dateFilter.$lte = new Date(endDate as string);

    const matchStage = Object.keys(dateFilter).length > 0
      ? { createdAt: dateFilter }
      : {};

    const [result] = await Order.aggregate([
      { $match: matchStage },
      {
        $facet: {

          // totalRevenue & totalOrders
          summary: [
            {
              $group: {
                _id:          null,
                totalRevenue: { $sum: '$total' },
                totalOrders:  { $sum: 1 },
              },
            },
          ],

          // topProducts
          topProducts: [
            { $unwind: '$items' },
            // Κανονικοποίηση productId σε ObjectId πριν το group
            {
              $addFields: {
                'items.productObjId': {
                  $cond: {
                    if:   { $eq: [{ $type: '$items.productId' }, 'objectId'] },
                    then: '$items.productId',
                    else: { $toObjectId: '$items.productId' },
                  },
                },
              },
            },
            // Group με ObjectId — αποτρέπει duplicates
            {
              $group: {
                _id:           '$items.productObjId',
                totalQuantity: { $sum: '$items.quantity' },
              },
            },
            // Lookup από products collection
            {
              $lookup: {
                from:         'products',
                localField:   '_id',
                foreignField: '_id',
                as:           'productInfo',
              },
            },
            // Κρατάμε μόνο products που υπάρχουν ακόμα στη βάση
            { $match: { productInfo: { $ne: [] } } },
            {
              $project: {
                _id:           0,
                productId:     '$_id',
                name:          { $arrayElemAt: ['$productInfo.name', 0] },
                totalQuantity: 1,
                totalRevenue: {
                  $multiply: [
                    '$totalQuantity',
                    { $arrayElemAt: ['$productInfo.price', 0] },
                  ],
                },
              },
            },
            { $sort: { totalRevenue: -1, totalQuantity: -1 } },
            { $limit: 10 },
          ],

          // revenueByPeriod — group by year-month
          revenueByPeriod: [
            {
              $group: {
                _id: {
                  year:  { $year:  '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                revenue: { $sum: '$total' },
                orders:  { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            {
              $project: {
                _id:    0,
                period: {
                  $concat: [
                    { $toString: '$_id.year' },
                    '-',
                    {
                      $cond: {
                        if:   { $lt: ['$_id.month', 10] },
                        then: { $concat: ['0', { $toString: '$_id.month' }] },
                        else: { $toString: '$_id.month' },
                      },
                    },
                  ],
                },
                revenue: { $round: ['$revenue', 2] },
                orders:  1,
              },
            },
          ],
        },
      },
    ]);

    // Default to 0 if no orders found (e.g. future date range)
    const summary = result.summary[0] ?? { totalRevenue: 0, totalOrders: 0 };

    res.status(200).json({
      totalRevenue:    Math.round(summary.totalRevenue * 100) / 100,
      totalOrders:     summary.totalOrders,
      topProducts:     result.topProducts,
      revenueByPeriod: result.revenueByPeriod,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;