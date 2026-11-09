import { useSearchParams } from "react-router";
import { ProfilePage } from "~/account/profile-form";

export default function ProfileFixture() {
  const [searchParams] = useSearchParams();
  const isEmpty = searchParams.get("state") === "empty";
  const isChangingPhone = searchParams.get("state") === "changing-phone";

  return (
    <ProfilePage
      email="ijeehenry@gmail.com"
      profile={{
        name: isEmpty ? null : "Lydia",
        phoneNumber: isChangingPhone ? "+234 803 123 4675" : "+234 813 603 0498",
        phoneVerified: !isChangingPhone,
        city: isEmpty ? null : "Lagos",
        address: isEmpty ? null : "4 Alh Mudashiru Eletu way, Osapa London Lekki",
        marketingConsent: true,
      }}
    />
  );
}
