import { LogoLoader } from "@/components/ui/LogoLoader";

/** Shown while any page is being prepared. It stays invisible for the first moment, so pages that open quickly never flash it. */
export default function Loading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <LogoLoader size={132} delayed />
    </div>
  );
}
