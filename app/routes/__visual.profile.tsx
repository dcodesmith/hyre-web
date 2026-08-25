import { ProfilePage } from "~/account/profile-form";

export default function ProfileFixture() {
  return (
    <ProfilePage
      email="ada@example.com"
      profile={{
        name: "Ada Lovelace",
        phoneNumber: "+2348012345678",
        city: "Lagos",
        address: "12 Marina",
        marketingConsent: false,
      }}
    />
  );
}
