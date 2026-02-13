import dayjs from 'dayjs';
import { PrismaClient, type Review } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const reviewRepository = {
   async getReviews(productId: number, limit?: number): Promise<Review[]> {
      // SELECT * FROM review WHERE productId = @productId ORDER BY createdAt DESC LIMIT @limit
      return prisma.review.findMany({
         where: { productId: productId },
         orderBy: { createdAt: 'desc' },
         take: limit,
      });
   },

   storeReviewSummary(productId: number, summary: string) {
      const now = new Date();
      const expiresAt = dayjs().add(7, 'days').toDate();
      const data = { content: summary, expiresAt, generatedAt: now, productId };
      return prisma.summary.upsert({
         where: { productId },
         create: data,
         update: data,
      });
   },
   async getReviewSummary(productId: number): Promise<string | null> {
      const summary = await prisma.summary.findFirst({
         where: {
            AND: [{ productId }, { expiresAt: { gt: new Date() } }],
         },
      });
      return summary ? summary.content : null;
   },
};
