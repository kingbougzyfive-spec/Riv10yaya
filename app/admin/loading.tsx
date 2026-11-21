import { LogoLoader } from "@/components/ui/LogoLoader";

/** Inside the admin area the menu and header stay put; only the page itself shows the crest while it loads. */
export default function Loading() {
  return (
    <div className="grid min-h-[55dvh] place-items-center">
      <LogoLoader size={112} delayed />
    </div>
  );
}
