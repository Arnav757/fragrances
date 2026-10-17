import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("shipping");

export default function Page() {
  return <InfoPage pageKey="shipping" />;
}
