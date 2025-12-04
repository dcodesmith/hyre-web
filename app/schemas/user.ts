import { z } from "zod";

// Comprehensive international phone number validation for specific countries
const phoneNumberValidation = z
  .string({
    error: "Phone number is required",
  })
  .refine(
    (value) => {
      // Remove any spaces, dashes, or parentheses for validation
      const cleanNumber = value.replace(/[\s\-\(\)]/g, "");

      // Country-specific validation patterns
      const countryPatterns = {
        // Nigeria (+234)
        "234": /^\+234[789][01]\d{8}$/,
        // Kenya (+254)
        "254": /^\+254[789][01]\d{8}$/,
        // Uganda (+256)
        "256": /^\+256[789][01]\d{8}$/,
        // Tanzania (+255)
        "255": /^\+255[789][01]\d{8}$/,
        // Rwanda (+250)
        "250": /^\+250[789][01]\d{8}$/,
        // Senegal (+221)
        "221": /^\+221[789][01]\d{8}$/,
        // Mali (+223)
        // United States & Canada (+1)
        "1": /^\+1\d{10}$/,
        // United Kingdom (+44)
        "44": /^\+44\d{10,11}$/,
        // United Arab Emirates (+971)
        "971": /^\+971\d{9}$/,
        // France (+33)
        "33": /^\+33\d{9}$/,
        // Germany (+49)
        "49": /^\+49\d{10,12}$/,
        // Spain (+34)
        "34": /^\+34\d{9}$/,
        // Italy (+39)
        "39": /^\+39\d{9,10}$/,
        // Netherlands (+31)
        "31": /^\+31\d{9}$/,
        // Ireland (+353)
        "353": /^\+353\d{9}$/,
        // India (+91)
        "91": /^\+91\d{10}$/,
        // Switzerland (+41)
        "41": /^\+41\d{9}$/,
        // Belgium (+32)
        "32": /^\+32\d{9}$/,
        // Japan (+81)
        "81": /^\+81\d{9,10}$/,
        // South Africa (+27)
        "27": /^\+27\d{9}$/,
        // Ghana (+233)
        "233": /^\+233\d{9}$/,
        // Cameroon (+237)
        "237": /^\+237\d{8}$/,
        // Sweden (+46)
        "46": /^\+46\d{9}$/,
        // Norway (+47)
        "47": /^\+47\d{8}$/,
        // Australia (+61)
        "61": /^\+61\d{9}$/,
        // Austria (+43)
        "43": /^\+43\d{10,12}$/,
        // China (+86)
        "86": /^\+86\d{11}$/,
        // Brazil (+55)
        "55": /^\+55\d{10,11}$/,
      };

      // Check if the number matches any country pattern
      for (const [countryCode, pattern] of Object.entries(countryPatterns)) {
        if (cleanNumber.startsWith(`+${countryCode}`) && pattern.test(cleanNumber)) {
          return true;
        }
      }

      return false;
    },
    {
      error: "Phone number must be a valid international number.",
    },
  );

export const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  phoneNumber: phoneNumberValidation,
  address: z.string().min(1, "Address cannot be empty"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
