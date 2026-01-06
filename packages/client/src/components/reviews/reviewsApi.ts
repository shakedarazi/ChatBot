import axios from 'axios';

export type Review = {
   id: number;
   author: string;
   content: string;
   rating: number;
   createdAt: string;
};

export type GetReviewsResponse = {
   summary: string | null;
   reviews: Review[];
};

export type SummaeizeResponse = {
   summary: string;
};

export const reviewsApi = {
   fetchReviews(productId: number) {
      return axios
         .get<GetReviewsResponse>(`/api/products/${productId}/reviews`)
         .then((res) => res.data);
   },

   summarizeReviews(productId: number) {
      return axios
         .post<SummaeizeResponse>(
            `/api/products/${productId}/reviews/summarize`
         )
         .then((res) => res.data);
   },
};
