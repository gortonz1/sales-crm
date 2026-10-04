export default function NoAccess() {
  return (
    <section className="flex flex-1 items-center justify-center px-4">
      <div className="flex max-w-[28em] flex-col gap-2 text-center">
        <h1>No access yet</h1>
        <p className="text-soft">
          You&apos;re signed in, but this account isn&apos;t on the CRM&apos;s
          access list, or its email address hasn&apos;t been confirmed yet.
          Confirm your email, or ask the owner to add your address.
        </p>
      </div>
    </section>
  );
}
