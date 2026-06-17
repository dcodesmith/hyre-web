declare global {
  interface Window {
    ENV: {
      APP_NAME: string;
      GOOGLE_MAPS_API_KEY: string;
      CLOUDFRONT_DOMAIN: string;
      DOMAIN: string;
      isProduction: boolean;
    };
    google: {
      maps: {
        importLibrary: (library: string) => Promise<any>;
        places: any;
      };
    };
  }
}
