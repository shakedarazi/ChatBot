import type { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { productRepository } from '../repositories/product.repository';
import { reviewRepository } from '../repositories/review.repository';

export const reviewController = {
   async getReviews(req: Request, res: Response) {
      const productId = Number(req.params.id);

      if (isNaN(productId)) {
         res.status(400).json({ error: 'Invaild product ID.' });
         return;
      }

      const product = await productRepository.getProduct(productId);
      if (!product) {
         res.status(400).json({ error: 'Product does not exist.' });
         return;
      }

      const reviews = await reviewRepository.getReviews(productId);
      const summary = await reviewRepository.getReviewSummary(productId);

      res.json({
         summary,
         reviews,
      });
   },

   async summarizeReviews(req: Request, res: Response) {
      const productId = Number(req.params.id);

      if (isNaN(productId)) {
         res.status(400).json({ error: 'Invaild product ID.' });
         return;
      }

      const product = await productRepository.getProduct(productId);
      if (!product) {
         res.status(400).json({ error: 'Invalid product' });
         return;
      }

      const reviews = await reviewRepository.getReviews(productId, 1);
      if (!reviews.length) {
         res.status(400).json({ error: 'There are no reviews to Summarize.' });
         return;
      }

      const summary = await reviewService.summarizeReviews(productId);
      res.json({ summary });
   },
};
