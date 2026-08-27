import { UserNav } from "~/auth/user-nav";

export default function UserNavFixture() {
  return (
    <section
      aria-labelledby="user-nav-fixture-title"
      className="flex min-h-[560px] flex-col gap-8 bg-white px-6 py-16"
    >
      <h1 id="user-nav-fixture-title" className="text-2xl font-semibold">
        User nav
      </h1>
      <div className="flex justify-end gap-8">
        <UserNav user={null} />
        <UserNav user={{ name: "Ada Lovelace", email: "ada@example.com" }} />
      </div>
    </section>
  );
}
