type CarCategoriesEndpointOptions = {
  limit: number;
  from?: Date;
};

export const apiEndpoints = {
  cars: {
    categories({ limit, from }: CarCategoriesEndpointOptions) {
      const search = new URLSearchParams({ limit: String(limit) });

      if (from) {
        search.set("from", from.toISOString());
      }

      return `/api/cars/categories?${search}`;
    },
  },
} as const;
