import { LogoLoader } from "@/components/ui/LogoLoader";

export default function Loading() {
  return (
    <div className="grid min-h-[55dvh] place-items-center">
      <LogoLoader size={112} delayed />
    </div>
  );
}
